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
*/

import { CircuitElm } from "./CircuitElm";
import { CurrentElm } from "./CurrentElm";
import { Graphics } from "./Graphics";
import { Color } from "./Color";
import { Locale } from "./Locale";
import { StringTokenizer } from "./StringTokenizer";
import { CircuitXMLSerializer } from "./CircuitXMLSerializer";
import { CircuitXMLDeserializer } from "./CircuitXMLDeserializer";
import { parseIntStrict } from "./NumberParse";
import { CirSim } from "./CirSim";
import { VAL_R, UNITS_OHMS } from "./ScopeConstants";

export class OhmMeterElm extends CurrentElm {
    // ---- NUEVO ----
    lockY: number = -1;
    locked: boolean = false;
    // ----------------

    constructor(xx: number, yy: number);
    constructor(xa: number, ya: number, xb: number, yb: number, f: number, st: StringTokenizer);
    constructor(xa: number, ya: number, xb?: number, yb?: number, f?: number, st?: StringTokenizer) {
        super(xa, ya, xb, yb, f, st);
        // ---- NUEVO ----
        if (xb === undefined) {
            this.lockY = 320;
        } else {
            try {
                this.lockY = parseIntStrict(st!.nextToken());
            } catch (e) {
                this.lockY = 320;
            }
        }
        // ----------------
    }

    // ---- NUEVO ----
    isBloqueoActivo(): boolean {
        return CirSim.isBloqueoActivo();
    }
    // ----------------

    dumpXml(doc: Document, elem: Element): void {
        super.dumpXml(doc, elem);
        // ---- NUEVO ----
        CircuitXMLSerializer.dumpAttr(elem, "lk", this.lockY);
        // ----------------
    }

    undumpXml(xml: CircuitXMLDeserializer): void {
        super.undumpXml(xml);
        // ---- NUEVO ----
        this.lockY = xml.parseIntAttr("lk", 320);
        // ----------------
    }

    showPropertiesOnCreate(): boolean { return false; }
    getDumpType(): number { return 216; }

    setPoints(): void {
        super.setPoints();
        this.calcLeads(26);
    }

    draw(g: Graphics): void {
        const cr = 12;

        // ---- NUEVO: comprobación de bloqueo ----
        this.locked = (this.lockY !== -1 && this.point1.y !== this.lockY) && this.isBloqueoActivo();
        // ----------------------------------------

        this.draw2Leads(g);
        if (this.locked)
            g.setColor(Color.red);
        else
            this.setVoltageColor(g, (this.nodes[0].v + this.nodes[1].v) / 2);
        this.setPowerColor(g, false);

        CircuitElm.drawThickCircle(g, this.center!.x, this.center!.y, cr);
        this.drawCenteredText(g, Locale.ohmString, this.center!.x, this.center!.y, true);

        this.setBbox(this.point1, this.point2, cr);
        this.doDots(g);

        if (this.showValues()) {
            let s: string;
            if (this.locked)
                s = "\u2014"; // em dash
            else if (this.current !== 0)
                s = CircuitElm.getShortUnitText(this.getVoltageDiff() / this.current, Locale.ohmString);
            else
                s = "";
            if (s.length > 0 && (this.dx === 0 || this.dy === 0))
                this.drawValues(g, s, cr);
        }
        this.drawPosts(g);
    }

    // ---- NUEVO: si está bloqueado, no inyecta corriente y no mide ----
    stamp(): void {
        if (this.locked) {
            // en lugar de la fuente de corriente, una R enorme (circuito abierto)
            CircuitElm.sim.stampResistor(this.nodes[0], this.nodes[1], 1e12);
            return;
        }
        super.stamp();
    }
    // --------------------------------------------------------------------

    getScopeValue(x: number): number {
        return (x === VAL_R) ? this.getVoltageDiff() / this.current : super.getScopeValue(x);
    }

    getScopeUnits(x: number): number {
        return (x === VAL_R) ? UNITS_OHMS : super.getScopeUnits(x);
    }

    canShowValueInScope(x: number): boolean {
        return x === VAL_R;
    }

    getInfo(arr: string[]): void {
        arr[0] = "ohmmeter";
        // ---- NUEVO ----
        if (this.locked) {
            arr[1] = "\u26A0 Posición Incorrecta";
            return;
        }
        // ----------------
        if (this.current === 0)
            arr[1] = "R = \u221E";
        else
            arr[1] = "R = " + CircuitElm.getUnitText(this.getVoltageDiff() / this.current, Locale.ohmString);
    }
}