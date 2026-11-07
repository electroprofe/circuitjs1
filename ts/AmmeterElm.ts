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

    AmmeterElm by Bill Collis

    javier Bloqueado - Modificaciones para permitir bloquear la posición vertical del amperímetro
*/

import { CircuitElm } from "./CircuitElm";
import { CircuitXMLSerializer } from "./CircuitXMLSerializer";
import { CircuitXMLDeserializer } from "./CircuitXMLDeserializer";
import { Choice } from "./Choice";
import { EditInfo } from "./EditInfo";
import { Graphics } from "./Graphics";
import { Color } from "./Color";
import { Locale } from "./Locale";
import { Point } from "./Point";
import { Polygon } from "./Polygon";
import { StringTokenizer } from "./StringTokenizer";
import { VoltageSource } from "./VoltageSource";
import { parseIntStrict, parseFloatStrict } from "./NumberParse";
import { CirSim } from "./CirSim";
import { ExplosionElm } from "./ExplosionElm";

export class AmmeterElm extends CircuitElm {
    meter: number = 0;
    scale: number;

    static readonly AM_VOL = 0;
    static readonly AM_RMS = 1;

    static readonly FLAG_SHOWCURRENT = 1;
    static readonly FLAG_CIRCLE = 2;

    // optional name, drawn next to the reading and usable as i(label) in an expression
    label: string = "";

    zerocount: number = 0;
    rmsI: number = 0;
    total: number = 0;
    count: number = 0;
    maxI: number = 0;
    lastMaxI: number = 0;
    minI: number = 0;
    lastMinI: number = 0;
    selectedValue: number = 0;

    increasingI: boolean = true;
    decreasingI: boolean = true;

    // ---- NUEVO: bloqueo por posición ----
    lockY: number = -1;       // coordenada Y bloqueada
    locked: boolean = false;  // estado calculado en draw()
    // ------------------------------------

    // ---- NUEVO: fusible / explosión ----
    maxCurrent: number = 20;      // umbral de fusión (A), editable
    // ---- NUEVO: overlay para el GIF animado ----
    overlayImg: HTMLImageElement | null = null;
    // -------------------------------------------
    blown: boolean = false;       // true si se ha fundido
    explosionStart: number = 0;   // Date.now() cuando empezó la explosión
    pendingReplacement: boolean = false; // ya programada la sustitución por ExplosionElm
    static readonly EXPLOSION_DURATION_MS = 1000;
    // ------------------------------------

    // GIF de explosión (compartido entre instancias)
    static explosionImage: HTMLImageElement | null = null;
    static explosionImageLoading: boolean = false;


    constructor(xx: number, yy: number);
    constructor(xa: number, ya: number, xb: number, yb: number, f: number, st: StringTokenizer);
    constructor(xxOrXa: number, yyOrYa: number, xb?: number, yb?: number, f?: number, st?: StringTokenizer) {
        if (xb === undefined) {
            super(xxOrXa, yyOrYa);
            this.flags = AmmeterElm.FLAG_SHOWCURRENT | AmmeterElm.FLAG_CIRCLE;
            this.scale = CircuitElm.SCALE_AUTO;
            this.lockY = 320;
            this.maxCurrent = 20;
        } else {
            super(xxOrXa, yyOrYa, xb, yb!, f!);
            this.scale = CircuitElm.SCALE_AUTO;
            this.meter = parseIntStrict(st!.nextToken());
            try {
                this.scale = parseIntStrict(st!.nextToken());
            } catch (e) {}
            try {
                this.lockY = parseIntStrict(st!.nextToken());
            } catch (e) {
                this.lockY = 320;
            }
            this.maxCurrent = 20;
        }
    }

    // ---- NUEVO ----
    isBloqueoActivo(): boolean {
        return CirSim.isBloqueoActivo();
    }
    // ----------------
    delete(): void {
        if (this.overlayImg != null) {
            this.overlayImg.remove();
            this.overlayImg = null;
        }
        super.delete();
    }
    // ---- NUEVO: marca de tiempo de la explosión ----
    explosionTime: number = 0;  // Date.now() cuando se fundió
    // ------------------------------------------------
    dumpXml(doc: Document, elem: Element): void {
        super.dumpXml(doc, elem);
        CircuitXMLSerializer.dumpAttr(elem, "me", this.meter);
        CircuitXMLSerializer.dumpAttr(elem, "sc", this.scale);
        if (this.label.length > 0)
            CircuitXMLSerializer.dumpAttr(elem, "lb", this.label);
        CircuitXMLSerializer.dumpAttr(elem, "lk", this.lockY);
        // ---- NUEVO: guardar maxCurrent (default 20) ----
        if (this.maxCurrent !== 20)
            CircuitXMLSerializer.dumpAttr(elem, "mc", this.maxCurrent);
        // ------------------------------------------------
    }

    undumpXml(xml: CircuitXMLDeserializer): void {
        super.undumpXml(xml);
        this.meter = xml.parseIntAttr("me", this.meter);
        this.scale = xml.parseIntAttr("sc", this.scale);
        this.label = xml.parseStringAttr("lb", "") ?? "";
        this.lockY = xml.parseIntAttr("lk", 320);
        // ---- NUEVO: leer maxCurrent, default 20 si no está ----
        this.maxCurrent = xml.parseDoubleAttr("mc", 20);
        // ------------------------------------------------------
    }

    getMeter(): string {
        switch (this.meter) {
        case AmmeterElm.AM_VOL: return "I";
        case AmmeterElm.AM_RMS: return "Irms";
        }
        return "";
    }

    center!: Point;
    mid!: Point;
    arrowPoly!: Polygon;

    setPoints(): void {
        super.setPoints();
        this.mid    = this.interpPoint(this.point1, this.point2, 0.6);
        this.center = this.interpPoint(this.point1, this.point2, 0.5);
        this.arrowPoly = this.calcArrow(this.point1, this.mid, 14, 7);
    }

    stepFinished(): void {
        // ---- NUEVO: si está mal colocado, no acumular medidas ----
        if (this.locked) {
            this.rmsI = 0;
            this.selectedValue = 0;
            this.count = 0;
            this.total = 0;
            this.zerocount = 0;
            return;
        }
        // ---------------------------------------------------------

        // ---- NUEVO: detectar fusión ----
        if (!this.blown && Math.abs(this.current) > this.maxCurrent) {
            this.blown = true;
            this.explosionStart = Date.now();
            this.explosionTime  = this.explosionStart;   // <-- NUEVO
            this.rmsI = 0;
            this.selectedValue = 0;
            this.count = 0;
            this.total = 0;
            this.zerocount = 0;
            CirSim.theApp?.needAnalyze();
            return;
        }
        // --------------------------------

        this.count++;
        this.total += this.current * this.current;
        if (this.current > this.maxI && this.increasingI) {
            this.maxI = this.current;
            this.increasingI = true;
            this.decreasingI = false;
        }
        if (this.current < this.maxI && this.increasingI) {
            this.lastMaxI = this.maxI;
            this.minI = this.current;
            this.increasingI = false;
            this.decreasingI = true;

            this.total = this.total / this.count;
            this.rmsI = Math.sqrt(this.total);
            if (isNaN(this.rmsI)) this.rmsI = 0;
            this.count = 0;
            this.total = 0;
        }
        if (this.current < this.minI && this.decreasingI) {
            this.minI = this.current;
            this.increasingI = false;
            this.decreasingI = true;
        }
        if (this.current > this.minI && this.decreasingI) {
            this.lastMinI = this.minI;
            this.maxI = this.current;
            this.increasingI = true;
            this.decreasingI = false;

            this.total = this.total / this.count;
            this.rmsI = Math.sqrt(this.total);
            if (isNaN(this.rmsI)) this.rmsI = 0;
            this.count = 0;
            this.total = 0;
        }
        if (this.current === 0) {
            this.zerocount++;
            if (this.zerocount > 5) {
                this.total = 0;
                this.rmsI  = 0;
                this.maxI  = 0;
                this.minI  = 0;
            }
        } else {
            this.zerocount = 0;
        }
        switch (this.meter) {
        case AmmeterElm.AM_VOL: this.selectedValue = this.current; break;
        case AmmeterElm.AM_RMS: this.selectedValue = this.rmsI; break;
        }
    }

    readonly circleSize = 12;

    draw(g: Graphics): void {
        super.draw(g);

        // ---- NUEVO: comprobación de bloqueo ----
        this.locked = (this.lockY !== -1 && this.point1.y !== this.lockY) && this.isBloqueoActivo();
        const bad = this.locked || this.blown;
        if (bad) {
            g.setColor(Color.red);
        } else {
            this.setVoltageColor(g, this.nodes[0].v);
        }
        // ----------------------------------------

        let width = 4;
        if (!this.drawAsCircle()) {
            CircuitElm.drawThickLine(g, this.point1, this.point2);
            g.fillPolygon(this.arrowPoly);
        } else {
            this.calcLeads(this.circleSize * 2);
            if (!bad)
                this.setVoltageColor(g, this.nodes[0].v);
            else
                g.setColor(Color.red);
            CircuitElm.drawThickLine(g, this.point1, this.lead1!);
            CircuitElm.drawThickLine(g, this.lead2!, this.point2);

            g.setColor(this.needsHighlight() ? CircuitElm.selectColor : CircuitElm.lightGrayColor);
            CircuitElm.drawThickCircle(g, this.center.x, this.center.y, this.circleSize);
            this.drawCenteredText(g, "A", this.center.x, this.center.y, true);

            g.setColor(CircuitElm.whiteColor);
            g.setFont(CircuitElm.unitsFont);
            const len = this.circleSize * 2;
            const plusPoint = this.interpPoint(this.point1, this.point2, (this.dn / 2 - len / 2 - 4) / this.dn, -10 * this.dsign) as Point;
            if (this.y2 > this.y) plusPoint.y += 4;
            if (this.y  > this.y2) plusPoint.y += 3;
            const w = Math.floor(g.context.measureText("+").width);
            g.drawString("+", plusPoint.x - w / 2, plusPoint.y);
            width = this.circleSize;
        }

        // ---- NUEVO: gestionar el overlay del GIF ----
        if (this.blown) {
            const elapsed = Date.now() - this.explosionStart;
            const  EXPLOSION_SIZE_PX = 320;  // <-- tamaño de la explosión en pantalla
            if (elapsed < AmmeterElm.EXPLOSION_DURATION_MS) {
                const size = EXPLOSION_SIZE_PX;
                // crear el <img> si no existe
                if (this.overlayImg == null) {
                    const img = document.createElement("img");
                    img.src = "images/explosion.gif"; //ojo la imagen la he copiado a mano en la raspi en el directorio dist/images
                    img.style.position = "absolute";
                    img.style.pointerEv"none";
                    img.style.zIndex = "1000";
                    img.style.width  = size + "px";
                    img.style.height = size + "px";
                    document.body.appendChild(img);
                    this.overlayImg = img;
                }
                // posicionar centrado en el amperímetro
                const mouse = CircuitElm.app.mouse;
                const canvas = CircuitElm.app.ui.cv as HTMLCanvasElement;
                const rect = canvas.getBoundingClientRect();
                const sx = mouse.transformX(this.center.x);
                const sy = mouse.transformY(this.center.y);
                this.overlayImg.style.left = (rect.left + sx - size / 1.7) + "px";
                this.overlayImg.style.top  = (rect.top  + sy - size / 1.1) + "px";
            } else {
                if (this.overlayImg != null) {
                    this.overlayImg.remove();
                    this.overlayImg = null;
                }
            }
        }
        // -------------------------------------------

        this.doDots(g);
        this.setBbox(this.point1, this.point2, width);

        // ---- NUEVO: mostrar "FUSIBLE" o "—" según estado ----
        let s = "A";
        if (this.blown) {
            s = "FUSIBLE";
        } else if (this.locked) {
            s = "\u2014"; // em dash
        } else {
            switch (this.meter) {
            case AmmeterElm.AM_VOL: s = CircuitElm.getUnitTextWithScale(this.getCurrent(), "A", this.scale); break;
            case AmmeterElm.AM_RMS: s = CircuitElm.getUnitTextWithScale(this.rmsI, "A(rms)", this.scale); break;
            }
        }
        // ---------------------------------------------------

        if (this.label.length > 0)
            s = this.label + " " + s;
        this.drawValues(g, s, width);
        this.drawPosts(g);
    }

    getDumpType(): number { return 370; }

    setVoltageSource(n: number, v: VoltageSource): void {
        super.setVoltageSource(n, v);
        v.setNodes(this.nodes[0], this.nodes[1]);
    }

    // 2. Estampamos según el estado
    stamp(): void {
        if (this.locked || this.blown) {
            // Comportamiento de circuito abierto: resistencia de aislamiento.
            // Usamos 1e9 (1000 MΩ), que es el valor estándar para que no circule corriente
            // pero el simulador sepa que los nodos existen.
            CircuitElm.sim.stampResistor(this.nodes[0], this.nodes[1], 1e9);
            return;
        }
        // Comportamiento normal de amperímetro (cable ideal)
        CircuitElm.sim.stampVoltageSource(this.nodes[0], this.nodes[1], this.voltSource, 0);
    }

    mustShowCurrent(): boolean {
        return (this.flags & AmmeterElm.FLAG_SHOWCURRENT) !== 0;
    }

    // 1. Decimos que el número de fuentes de tensión depende del estado
    getVoltageSourceCount(): number {
        // Si está bloqueado, NO le pedimos a la matriz que reserve una fuente de tensión.
        if (this.locked || this.blown) return 0;
        return 1;
    }

    getInfo(arr: string[]): void {
        arr[0] = "Ammeter";
        if (this.blown) {
            arr[1] = "\u26A0 Amperímetro fundido";
            return;
        }
        if (this.locked) {
            arr[1] = "\u26A0 Posición Incorrecta";
            return;
        }
        switch (this.meter) {
        case AmmeterElm.AM_VOL: arr[1] = "I = "    + CircuitElm.getUnitText(this.current, "A"); break;
        case AmmeterElm.AM_RMS: arr[1] = "Irms = " + CircuitElm.getUnitText(this.rmsI, "A"); break;
        }
    }

    getPower(): number { return 0; }
    getVoltageDiff(): number { return this.nodes[0].v; }

    isWireEquivalent(): boolean { return true; }

    drawAsCircle(): boolean {
        return (this.flags & AmmeterElm.FLAG_CIRCLE) !== 0;
    }

    // ---- NUEVO: tras la animación, sustituirse por ExplosionElm ----
    // Lo llama UIManager.updateCircuit() una vez por frame, recorriendo elmList.
    // Devuelve true si este elemento debe ser sustituido.
    shouldBeReplacedByExplosion(): boolean {
        if (!this.blown || this.pendingReplacement)
            return false;
        if (Date.now() - this.explosionStart < AmmeterElm.EXPLOSION_DURATION_MS)
            return false;
        this.pendingReplacement = true;
        return true;
    }

    createExplosionReplacement(): ExplosionElm {
        const ex = new ExplosionElm(this.x, this.y, this.x2, this.y2, 0);
        ex.setPoints();
        ex.explosionTime = this.explosionTime;   // <-- NUEVO
        return ex;
    }
    // -----------------------------------------------------------------

    showPropertiesOnCreate(): boolean { return false; }
    getEditInfo(n: number): EditInfo | null {
        if (n === 0) {
            const ei = new EditInfo("Value", this.selectedValue, -1, -1);
            ei.choice = new Choice();
            ei.choice.add("Current");
            ei.choice.add("RMS Current");
            ei.choice.select(this.meter);
            return ei;
        }
        if (n === 1) {
            const ei = new EditInfo("Scale", 0);
            ei.choice = new Choice();
            ei.choice.add("Auto");
            ei.choice.add("A");
            ei.choice.add("mA");
            ei.choice.add(Locale.muString + "A");
            ei.choice.select(this.scale);
            return ei;
        }
        if (n === 2) {
            return EditInfo.createCheckbox("Circular Symbol", this.drawAsCircle());
        }
        if (n === 3) {
            const ei = new EditInfo("Label", 0, -1, -1);
            ei.text = this.label;
            return ei;
        }
        // ---- NUEVO: corriente máxima ----
        if (n === 4) {
            return new EditInfo("Max Current (A)", this.maxCurrent);
        }
        // ---------------------------------
        return null;
    }

    setEditValue(n: number, ei: EditInfo): void {
        if (n === 0) this.meter = ei.choice!.getSelectedIndex();
        if (n === 1) this.scale = ei.choice!.getSelectedIndex();
        if (n === 2) this.flags = ei.changeFlag(this.flags, AmmeterElm.FLAG_CIRCLE);
        if (n === 3) this.label = ei.textf ? ei.textf.value : (ei.text ?? "");
        // ---- NUEVO: corriente máxima ----
        if (n === 4) {
            const v = ei.textf ? parseFloatStrict(ei.textf.value) : ei.value;
            if (!isNaN(v) && v > 0)
                this.maxCurrent = v;
        }
        // ---------------------------------
    }

    getExprRefName(): string | null { return this.label.length > 0 ? this.label : null; }
}