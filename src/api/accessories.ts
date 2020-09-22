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

export default class AccessoriesController {
    constructor() {
        Instance.app?.get("/api/accessories/:instance", (request, response) => this.list(request, response));
        Instance.app?.get("/api/accessory/:instance/:id", (request, response) => this.get(request, response));
        Instance.app?.put("/api/accessory/:instance/:id/:service", (request, response) => this.set(request, response));
    }

    async list(request: Request, response: Response): Promise<void> {
        response.send(await command(request.params.instance, "accessories:list"));
    }

    async get(request: Request, response: Response): Promise<void> {
        response.send(await command(request.params.instance, "accessory:get", { id: request.params.id }));
    }

    async set(request: Request, response: Response): Promise<void> {
        response.send(await command(request.params.instance, "accessory:set", { id: request.params.id }, request.body));
    }
}