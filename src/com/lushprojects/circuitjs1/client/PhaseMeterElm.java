package com.lushprojects.circuitjs1.client;

import java.util.StringTokenizer;
import com.lushprojects.circuitjs1.client.CircuitElm; // Importar CircuitElm
import com.lushprojects.circuitjs1.client.CirSim; // Importar Simulación

class PhaseMeterElm extends CircuitElm {

    double lastZeroCrossingV = -1, lastZeroCrossingI = -1;
    double phaseAngle = 0;

    public PhaseMeterElm(int xx, int yy) {
        super(xx, yy);
    }

    public PhaseMeterElm(int xa, int ya, int xb, int yb, int f, StringTokenizer st) {
        super(xa, ya, xb, yb, f);
    }

    int getPostCount() {
        return 4; // Dos entradas de tensión y dos de corriente
    }

    void setPoints() {
        super.setPoints();
    }

    void draw(CircuitElm.Graphics g) {
        setBbox(point1, point2, 6);
        draw2Leads(g);
        setPowerColor(g, true);
        drawCenteredText(g, "φ=" + Math.round(phaseAngle) + "°", x2, y2, true);
        drawPosts(g);
    }

    void doStep() {
        double vA = volts[0];  // Tensión
        double iA = volts[2];  // Corriente

        // Detectar cruce por cero de tensión
        if (vA >= 0 && lastZeroCrossingV < 0) {
            lastZeroCrossingV = sim.t;
        }

        // Detectar cruce por cero de corriente
        if (iA >= 0 && lastZeroCrossingI < 0) {
            lastZeroCrossingI = sim.t;
        }

        // Calcular ángulo de fase
        if (lastZeroCrossingV > 0 && lastZeroCrossingI > 0) {
            double deltaT = lastZeroCrossingI - lastZeroCrossingV;
            double period = 1.0 / sim.timeStep;
            phaseAngle = 360 * (deltaT / period);

            // Asegurar que el ángulo esté entre -180° y 180°
            if (phaseAngle > 180) phaseAngle -= 360;
            if (phaseAngle < -180) phaseAngle += 360;
        }
    }

    String getInfo() {
        return "Fasímetro: φ = " + Math.round(phaseAngle) + "°";
    }

    int getVoltageSourceCount() {
        return 0;
    }

    boolean getConnection(int n1, int n2) {
        return true;
    }

    boolean hasGroundConnection(int n1) {
        return false;
    }
}
