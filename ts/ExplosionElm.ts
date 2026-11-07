/*
    Copyright (C) Paul Falstad and Iain Sharp

    This file is part of CircuitJS1.

    CircuitJS1 is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 2 of the License, or
    (at your option) any later version.

    CircuitJS1 is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with CircuitJS1.  If not, see <http://www.gnu.org/licenses/>.

    ExplosionElm - "restos" de un amperímetro fundido.
    Sustituye al AmmeterElm cuando éste explota.  Es un circuito abierto
    (R enorme entre sus dos posts), seleccionable, movible y borrable.
*/

import { CircuitElm } from "./CircuitElm";
import { CircuitXMLSerializer } from "./CircuitXMLSerializer";
import { CircuitXMLDeserializer } from "./CircuitXMLDeserializer";
import { Graphics } from "./Graphics";
import { Color } from "./Color";
import { Point } from "./Point";
import { StringTokenizer } from "./StringTokenizer";

export class ExplosionElm extends CircuitElm {

    // GIF compartido con AmmeterElm (misma URL, cacheado por el navegador)
    static explosionImage: HTMLImageElement | null = null;
    static explosionImageLoading: boolean = false;
    // ---- NUEVO: fecha/hora de la explosión ----
    explosionTime: number = 0;
    // -------------------------------------------

    // no se puede borrar: es un registro permanente
    isDeletable(): boolean { return false; }

    static loadExplosionImage(): void {
        if (ExplosionElm.explosionImage != null || ExplosionElm.explosionImageLoading)
            return;
        ExplosionElm.explosionImageLoading = true;
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            ExplosionElm.explosionImage = img;
            ExplosionElm.explosionImageLoading = false;
        };
        img.onerror = () => {
            ExplosionElm.explosionImageLoading = false;
        };
        img.src = "https://i.gifer.com/3IsK.gif";
    }

    constructor(xx: number, yy: number);
    constructor(xa: number, ya: number, xb: number, yb: number, f: number);
    constructor(xa: number, ya: number, xb?: number, yb?: number, f?: number) {
        if (xb === undefined) {
            super(xa, ya);
            ExplosionElm.loadExplosionImage();
        } else {
            super(xa, ya, xb, yb!, f!);
            ExplosionElm.loadExplosionImage();
        }
    }
    dumpXml(doc: Document, elem: Element): void {
        super.dumpXml(doc, elem);
        if (this.explosionTime !== 0)
            CircuitXMLSerializer.dumpAttr(elem, "et", this.explosionTime);
    }
    
    undumpXml(xml: CircuitXMLDeserializer): void {
        super.undumpXml(xml);
        this.explosionTime = xml.parseDoubleAttr("et", 0);
    }
    getDumpType(): number { return 371; }
    getXmlDumpType(): string { return "ex"; }

    getPostCount(): number { return 2; }

    // circuito abierto: no conduce
    stamp(): void {
        CircuitElm.sim.stampResistor(this.nodes[0], this.nodes[1], 1e12);
    }

    // no se optimiza fuera aunque sea casi-abierto
    isWireEquivalent(): boolean { return false; }

    draw(g: Graphics): void {
        super.draw(g);

        // dibujar el icono/último frame de explosión centrado
        if (ExplosionElm.explosionImage != null) {
            const size = 48;
            const cx = (this.x + this.x2) / 2;
            const cy = (this.y + this.y2) / 2;
            g.context.drawImage(ExplosionElm.explosionImage, cx - size / 2, cy - size / 2, size, size);
        } else {
            // fallback si el GIF no carga: un círculo rojo con una X
            const cx = (this.x + this.x2) / 2;
            const cy = (this.y + this.y2) / 2;
            g.setColor(Color.red);
            CircuitElm.drawThickCircle(g, cx, cy, 12);
            CircuitElm.drawThickLine(g, cx - 8, cy - 8, cx + 8, cy + 8);
            CircuitElm.drawThickLine(g, cx - 8, cy + 8, cx + 8, cy - 8);
        }

        this.setBbox(this.point1, this.point2, 16);
        this.drawPosts(g);
    }

    getInfo(arr: string[]): void {
        arr[0] = "Explosión";
        arr[1] = "Amperímetro fundido";
        if (this.explosionTime !== 0) {
            const d = new Date(this.explosionTime);
            // formato local: dd/mm/aaaa hh:mm:ss
            const dd   = String(d.getDate()).padStart(2, "0");
            const mm   = String(d.getMonth() + 1).padStart(2, "0");
            const yyyy = d.getFullYear();
            const hh   = String(d.getHours()).padStart(2, "0");
            const mi   = String(d.getMinutes()).padStart(2, "0");
            const ss   = String(d.getSeconds()).padStart(2, "0");
            arr[2] = "Fecha: " + dd + "/" + mm + "/" + yyyy + " " + hh + ":" + mi + ":" + ss;
        }
    }

    getPower(): number { return 0; }
    getVoltageDiff(): number { return 0; }

    // es seleccionable / movible / borrable como cualquier otro
    canViewInScope(): boolean { return false; }
}