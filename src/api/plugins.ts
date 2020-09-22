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

import { Request, Response } from "express-serve-static-core";
import Instance from "../shared/instance";
import { command } from "./socket";

export default class PluginsController {
    constructor() {
        Instance.app?.get("/api/plugins/:instance", (request, response) => this.installed(request, response));
        Instance.app?.put("/api/plugins/:instance/:name", (request, response) => this.install(request, response));
        Instance.app?.put("/api/plugins/:instance/:scope/:name", (request, response) => this.install(request, response));
        Instance.app?.post("/api/plugins/:instance/:name", (request, response) => this.upgrade(request, response));
        Instance.app?.post("/api/plugins/:instance/:scope/:name", (request, response) => this.upgrade(request, response));
        Instance.app?.delete("/api/plugins/:instance/:name", (request, response) => this.uninstall(request, response));
        Instance.app?.delete("/api/plugins/:instance/:scope/:name", (request, response) => this.uninstall(request, response));
    }

    async installed(request: Request, response: Response): Promise<void> {
        response.send(await command(request.params.instance, "plugins:get"));
    }

    async install(request: Request, response: Response): Promise<void> {
        response.send(await command(request.params.instance, "plugins:install", request.params));
    }

    async upgrade(request: Request, response: Response): Promise<void> {
        response.send(await command(request.params.instance, "plugins:upgrade", request.params));
    }

    async uninstall(request: Request, response: Response): Promise<void> {
        response.send(await command(request.params.instance, "plugins:uninstall", request.params));
    }
}