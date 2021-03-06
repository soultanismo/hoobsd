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
import Instance from "../services/instance";
import Config from "../services/config";
import Socket from "./socket";

export default class ConfigController {
    constructor() {
        Instance.app?.get("/api/config", (request, response) => this.getConsole(request, response));
        Instance.app?.post("/api/config", (request, response) => this.saveConsole(request, response));
        Instance.app?.get("/api/config/:instance", (request, response) => this.getInstance(request, response));
        Instance.app?.post("/api/config/:instance", (request, response) => this.saveInstance(request, response));
    }

    async getConsole(_request: Request, response: Response): Promise<void> {
        response.send(Instance.api?.config);
    }

    async saveConsole(request: Request, response: Response): Promise<void> {
        Config.saveConfig(request.body);

        if (Instance.bridge) await Instance.bridge.restart();

        response.send({
            success: true,
        });
    }

    async getInstance(request: Request, response: Response): Promise<void> {
        response.send(await Socket.fetch(request.params.instance, "config:get"));
    }

    async saveInstance(request: Request, response: Response): Promise<void> {
        response.send(await Socket.fetch(request.params.instance, "config:save", request.params, request.body));
    }
}
