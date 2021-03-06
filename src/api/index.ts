/**************************************************************************************************
 * hoobsd                                                                                         *
 * Copyright (C) 2020 HOOBS                                                                       *
 *                                                                                                *
 * This program is free software: you can redistribute it and/or modify                           *
 * it under the terms of the GNU General Public License as published by                           *
 * the Free Software Foundation, either version 3 of the License, or                              *
 * (at your option) any later version.                                                            *
 *                                                                                                *
 * This program is distributed in the hope that it will be useful,                                *
 * but WITHOUT ANY WARRANTY; without even the implied warranty of                                 *
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the                                  *
 * GNU General Public License for more details.                                                   *
 *                                                                                                *
 * You should have received a copy of the GNU General Public License                              *
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.                          *
 **************************************************************************************************/

import _ from "lodash";
import HTTP from "http";
import Express from "express";
import IO from "socket.io";
import Parser from "body-parser";
import CORS from "cors";
import PTY from "node-pty";
import { createHttpTerminator, HttpTerminator } from "http-terminator";
import { EventEmitter } from "events";
import { realpathSync, existsSync } from "fs-extra";
import { dirname, join } from "path";
import { LogLevel } from "homebridge/lib/logger";
import Paths from "../services/paths";
import Config from "../services/config";
import Instance from "../services/instance";
import Users from "../services/users";
import Socket from "./socket";
import Monitor from "./monitor";
import Plugins from "../services/plugins";
import { Console, Events } from "../services/logger";

import AuthController from "./auth";
import StatusController from "./status";
import LogController from "./log";
import AccessoriesController from "./accessories";
import BridgeController from "./bridge";
import CacheController from "./cache";
import ConfigController from "./config";
import ExtentionsController from "./extentions";
import InstancesController from "./instances";
import PluginsController from "./plugins";
import RemoteController from "./remote";
import SystemController from "./system";

export default class API extends EventEmitter {
    declare time: number;

    declare readonly config: any;

    declare readonly settings: any;

    declare readonly port: number;

    declare private enviornment: { [key: string]: string };

    declare private socket: Socket;

    declare private listner: HTTP.Server;

    declare private terminator: HttpTerminator;

    constructor(port: number | undefined) {
        super();

        this.time = 0;
        this.config = Config.configuration();
        this.settings = (this.config || {}).api || {};
        this.port = port || 80;

        Instance.app = Express();

        this.listner = HTTP.createServer(Instance.app);

        this.terminator = createHttpTerminator({
            server: this.listner,
        });

        Instance.io = IO(this.listner);

        const paths = [];

        for (let i = 0; i < Instance.instances.length; i += 1) {
            if (Instance.instances[i].plugins && existsSync(join(<string>Instance.instances[i].plugins, ".bin"))) {
                paths.push(join(<string>Instance.instances[i].plugins, ".bin"));
            }
        }

        this.enviornment = {
            PATH: `${join(dirname(realpathSync(join(__filename, "../../"))), "cmd")}:${process.env.PATH}:${paths.join(":")}`,
        };

        if (existsSync("/etc/ssl/certs/cacert.pem")) this.enviornment.SSL_CERT_FILE = "/etc/ssl/certs/cacert.pem";

        Instance.io?.on("connection", (socket: IO.Socket): void => {
            socket.on(Events.SHELL_CONNECT, () => {
                let shell: PTY.IPty | undefined;

                try {
                    shell = PTY.spawn(process.env.SHELL || "sh", [], {
                        name: "xterm-color",
                        cwd: Paths.storagePath(),
                        env: _.create(process.env, this.enviornment),
                    });
                } catch (error) {
                    shell = undefined;

                    Console.error(error.message);
                    Console.debug(error.stack);

                    return;
                }

                shell?.onData((data: any) => {
                    socket.emit(Events.SHELL_OUTPUT, data);
                });

                socket.on(Events.SHELL_INPUT, (data: any): void => {
                    shell?.write(data);
                });

                socket.on(Events.SHELL_RESIZE, (data): void => {
                    const parts = data.split(":");

                    if (parts.length === 3 && !Number.isNaN(parseInt(parts[1], 10)) && !Number.isNaN(parseInt(parts[2], 10))) {
                        shell?.resize(
                            parseInt(parts[1], 10),
                            parseInt(parts[2], 10),
                        );
                    }
                });

                socket.on(Events.SHELL_CLEAR, (): void => {
                    shell?.write("clear\r");
                });

                socket.on(Events.SHELL_DISCONNECT, (): void => {
                    shell?.write("exit\r");
                    shell = undefined;
                });
            });
        });

        Instance.app?.use(CORS({
            origin: this.settings.origin || "*",
        }));

        Instance.app?.use(Parser.json());

        if (Instance.debug) {
            Instance.app?.use((request, _response, next) => {
                this.emit("request", request.method, request.url);

                next();
            });
        }

        Instance.app?.use(async (request, response, next) => {
            if (this.settings.disable_auth) {
                next();

                return;
            }

            if (request.url.indexOf("/api") === 0 && [
                "/api/auth",
                Users.count() > 0 ? "/api/auth/logon" : null,
                Users.count() === 0 ? "/api/auth/create" : null,
            ].indexOf(request.url) === -1 && (!request.headers.authorization || !(await Users.validateToken(request.headers.authorization)))) {
                response.status(403).json({
                    error: "unauthorized",
                });

                return;
            }

            next();
        });

        Instance.app?.get("/api", (_request, response) => response.send({ version: Instance.version }));

        new AuthController();
        new StatusController();
        new LogController();
        new AccessoriesController();
        new BridgeController();
        new CacheController();
        new ConfigController();
        new ExtentionsController();
        new InstancesController();
        new PluginsController();
        new RemoteController();
        new SystemController();

        let gui: string | undefined = Plugins.findModule("@hoobs/gui");

        if (gui && existsSync(join(gui, "lib"))) gui = join(gui, "lib");

        let touch: string | undefined = Plugins.findModule("@hoobs/touch");

        if (touch && existsSync(join(touch, "lib"))) touch = join(touch, "lib");

        Instance.app?.use("/", Express.static(this.settings.gui_path || gui || join(dirname(realpathSync(__filename)), "../../var")));
        Instance.app?.use("/touch", Express.static(this.settings.touch_path || touch || join(dirname(realpathSync(__filename)), "../../var")));
        Instance.app?.use("/themes", Express.static(Paths.themePath()));
        Instance.app?.use("/backups", Express.static(Paths.backupPath()));

        const defined: string[] = [];

        for (let i = 0; i < Instance.instances.length; i += 1) {
            if (Instance.instances[i].type === "bridge") {
                Plugins.load(Instance.instances[i].id, (_identifier, name, _scope, directory) => {
                    const route = `/plugin/${name.replace(/[^a-zA-Z0-9-_]/, "")}`;

                    if (defined.indexOf(route) === -1 && existsSync(join(directory, "static"))) {
                        Instance.app?.use(route, Express.static(join(directory, "static")));

                        defined.push(route);
                    }
                });
            }
        }
    }

    static createServer(port: number): API {
        const api = new API(port);

        api.on(Events.LISTENING, () => {
            Console.info(`API is running on port ${port}`);
        });

        api.on(Events.REQUEST, (method, url) => {
            Console.debug(`"${method}" ${url}`);
        });

        return api;
    }

    async start(): Promise<void> {
        this.socket = new Socket();

        this.socket.on(Events.LOG, (data: any) => Console.log(LogLevel.INFO, data));
        this.socket.on(Events.NOTIFICATION, (data: any) => Instance.io?.sockets.emit(Events.NOTIFICATION, data));
        this.socket.on(Events.ACCESSORY_CHANGE, (data: any) => Instance.io?.sockets.emit(Events.ACCESSORY_CHANGE, data));

        this.socket.start();

        for (let i = 0; i < Instance.instances.length; i += 1) {
            if (Instance.instances[i].type === "bridge") Console.import((await Socket.fetch(Instance.instances[i].id, "cache:log")) || []);
        }

        this.listner?.listen(this.port, () => {
            this.time = new Date().getTime();
            this.emit(Events.LISTENING, this.port);
        });

        Monitor();
    }

    async stop(): Promise<void> {
        Console.debug("");
        Console.debug("Shutting down");

        await this.terminator.terminate();

        this.socket.stop();
    }
}
