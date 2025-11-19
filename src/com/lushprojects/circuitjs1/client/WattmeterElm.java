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

package com.lushprojects.circuitjs1.client;

import com.gargoylesoftware.htmlunit.javascript.host.Console;
import com.google.gwt.core.client.GWT;

class WattmeterElm extends CircuitElm {
    int width;
    int voltSources[];
    double currents[];
    double curcounts[];


    /* -----------------------------
       VARIABLES INTERNAS
    ------------------------------ */
    double v;       // tensión instantánea
    double i;       // corriente instantánea


    // Variables para detección de cruce por cero
    private double lastVoltage = 0;
    private boolean firstZeroCross = true;
    
    // Variables de tiempo


    
    // Acumuladores del periodo actual
    private double currentPeriodEnergy = 0;
    private double currentPeriodTime = 0;

    

    // Control de estado

    private int periodsCompleted = 0;
    private double detectedFrequency = 60;

    double averagePower;

    int voltSource;
    public WattmeterElm(int xx, int yy) {
    super(xx, yy);
    noDiagonal = false;
	setup();
    }
    public WattmeterElm(int xa, int ya, int xb, int yb, int f,
	    StringTokenizer st) {
	super(xa, ya, xb, yb, f);
	width = Integer.parseInt(st.nextToken());
    noDiagonal = false;
	setup();
    }

    void setup() {
	voltSources = new int[2];
	currents = new double[2];
	curcounts = new double[2];

    }

    String dump() { return super.dump() + " " + width; }

    int getVoltageSourceCount() { return 1; }
    int getDumpType() { return 420; }
    int getPostCount() { return 4; }


    Point posts[];
    Point inner[];
    int maxTextLen;

    int rectPointsX[], rectPointsY[];
    Point center;

    Point getPost(int n) {
	return posts[n];
    }

    @Override
    void stamp() {
        // Fuente de tensión 0V entre bornes de corriente (para medir I)
        sim.stampVoltageSource(nodes[2], nodes[3], voltSource, 0);

        // Resistencia alta entre bornes de tensión (para medir V)
        sim.stampResistor(nodes[0], nodes[1], 1e9);
    }

   @Override
    void setVoltageSource(int n, int v) {
        voltSource = v;
        voltSources[1] = v;     // <-- esta rama (nodos 2-3) debe ser currents[1]
    }


    void drag(int xx, int yy) {
        
        xx = sim.snapGrid(xx);
        yy = sim.snapGrid(yy);
        
        // Mantener la posición original como referencia
        x2 = xx;
        y2 = yy;
        
        setPoints();

    }

    void setPoints() {
        super.setPoints();
        
        // Calcular direcciones originales antes de normalizar
        boolean invertX = point2.x < point1.x;
        boolean invertY = point2.y < point1.y;

        if (posts == null || posts.length < 4)
            posts = new Point[4];
        
        int gs = sim.gridSize;
        int minSize = 4 * gs;
        
        // Calcular dimensiones del rectángulo
        int dx = point2.x - point1.x;
        int dy = point2.y - point1.y;
        
        // Aplicar tamaño mínimo manteniendo la dirección del arrastre
        if (Math.abs(dx) < minSize) {
            dx = (dx >= 0) ? minSize : -minSize;
        }
        if (Math.abs(dy) < minSize) {
            dy = (dy >= 0) ? minSize : -minSize;
        }
        
        // Actualizar point2 con las dimensiones mínimas aplicadas
        point2 = new Point(point1.x + dx, point1.y + dy);
        
        // Calcular coordenadas del rectángulo normalizado
        int x1 = Math.min(point1.x, point2.x);
        int y1 = Math.min(point1.y, point2.y);
        int x2 = Math.max(point1.x, point2.x);
        int y2 = Math.max(point1.y, point2.y);
        
        // Asegurar que las dimensiones sean múltiplos de 2 para tener centro exacto
        int width = x2 - x1;
        int height = y2 - y1;
        
        if (width % (2 * gs) != 0) {
            x2 = x1 + ((width + gs - 1) / (2 * gs)) * (2 * gs);
        }
        if (height % (2 * gs) != 0) {
            y2 = y1 + ((height + gs - 1) / (2 * gs)) * (2 * gs);
        }
        
        // Recalcular después de los ajustes
        width = x2 - x1;
        height = y2 - y1;
        
        // Calcular centro del rectángulo (ajustado a rejilla)
        int cx = sim.snapGrid(x1 + width / 2);
        int cy = sim.snapGrid(y1 + height / 2);
        
    // Determinar cuadrante
        boolean right = dx >= 0;
        boolean down = dy >= 0;

        // Asignar posts según cuadrante
        if (right && down) {
            // Cuadrante I: derecha-abajo
            posts[0] = new Point(cx, y1); // V+ arriba
            posts[1] = new Point(cx, y2); // V- abajo
            posts[2] = new Point(x1, cy); // I+ izquierda
            posts[3] = new Point(x2, cy); // I- derecha
        } else if (right && !down) {
            // Cuadrante II: derecha-arriba
            posts[0] = new Point(x1, cy); // V+ izquierda
            posts[1] = new Point(x2, cy); // V- derecha
            posts[2] = new Point(cx, y2); // I+ abajo
            posts[3] = new Point(cx, y1); // I- arriba
        } else if (!right && down) {
            // Cuadrante III: izquierda-abajo
            posts[0] = new Point(x2, cy); // V+ derecha
            posts[1] = new Point(x1, cy); // V- izquierda
            posts[2] = new Point(cx, y1); // I+ arriba
            posts[3] = new Point(cx, y2); // I- abajo
        } else {
            // Cuadrante IV: izquierda-arriba
            posts[0] = new Point(cx, y2); // V+ abajo
            posts[1] = new Point(cx, y1); // V- arriba
            posts[2] = new Point(x2, cy); // I+ derecha
            posts[3] = new Point(x1, cy); // I- izquierda
        }
        
        x2 = x1 + (cx - x1) * 2 + 8;
        y2 = y1 + (cy - y1) * 2 + 8;
        
        setBbox(x1, y1, x2, y2);
    }

    @Override
    void draw(Graphics g) {
        int cx = (posts[0].x + posts[1].x) / 2;
        int cy = (posts[2].y + posts[3].y) / 2;
        int r = 12;

        g.setColor(needsHighlight() ? selectColor : lightGrayColor);
        drawThickCircle(g, cx, cy, r);

        g.setColor(whiteColor);
        drawCenteredText(g, "W", cx, cy, true);

        // Determinar cuadrante basado en la posición de point2 respecto a point1
        int dx = point2.x - point1.x;
        int dy = point2.y - point1.y;
        
        // Factores de dirección para las etiquetas
        int currentLabelX, currentLabelY, voltageLabelX, voltageLabelY;
        
        if (dx >= 0 && dy >= 0) {
            // Cuadrante I: derecha-abajo - i+ izquierda, v+ arriba
            currentLabelX = cx - r - 8;
            currentLabelY = cy - 8;
            voltageLabelX = cx + 8;
            voltageLabelY = cy - r - 8;
        } else if (dx >= 0 && dy < 0) {
            // Cuadrante II: derecha-arriba - v+ izquierda, i+ abajo
            currentLabelX = cx - 8;
            currentLabelY = cy + r + 8;
            voltageLabelX = cx - r - 8;
            voltageLabelY = cy - 8;
        } else if (dx < 0 && dy >= 0) {
            // Cuadrante III: izquierda-abajo - v+ derecha, i+ arriba
            currentLabelX = cx + 8;
            currentLabelY = cy - r - 8;
            voltageLabelX = cx + r + 8;
            voltageLabelY = cy - 8;
        } else {
            // Cuadrante IV: izquierda-arriba - i+ derecha, v+ abajo
            // Ajuste: i+ se coloca arriba en lugar de abajo para evitar superposición
            currentLabelX = cx + r + 8;
            currentLabelY = cy - r + 4;  // Cambiado de cy + 8 a cy - r - 8
            voltageLabelX = cx - 8;
            voltageLabelY = cy + r + 8;
        }

        // Dibujar etiquetas
        drawCenteredText(g, "i+", currentLabelX, currentLabelY, true);
        drawCenteredText(g, "v+", voltageLabelX, voltageLabelY, true);

        // Ajustar posición de la etiqueta de potencia para evitar superposiciones
        int powerLabelY = cy + 12;
        if (dx < 0 && dy < 0) {
            // En cuadrante IV, mover la potencia un poco más abajo si es necesario
            powerLabelY = cy + 16;
        }
        drawCenteredText(g, getUnitText(averagePower, "W"), cx + 10, powerLabelY, hasWireInfo);

        g.setColor(lightGrayColor);
        
        // Dibujar líneas de conexión desde los posts hasta el círculo
        for (int i = 0; i < 4; i++) {
            Point post = posts[i];
            int lineX = cx;
            int lineY = cy;
            
            // Determinar punto de conexión en el círculo basado en la posición del post
            if (post.x < cx) {
                lineX = cx - r; // Conectar al lado izquierdo del círculo
            } else if (post.x > cx) {
                lineX = cx + r; // Conectar al lado derecho del círculo
            }
            if (post.y < cy) {
                lineY = cy - r; // Conectar a la parte superior del círculo
            } else if (post.y > cy) {
                lineY = cy + r; // Conectar a la parte inferior del círculo
            }
            
            drawThickLine(g, post.x, post.y, lineX, lineY);
        }

        for (int i = 0; i < 4; i++) drawPost(g, posts[i]);
    }

    @Override
    void reset() {
        // Reiniciar variables de medición de energía
        currentPeriodEnergy = 0;
        currentPeriodTime = 0;
        
        // Reiniciar buffers de periodos
        periodEnergies = new double[4];
        periodTimes = new double[4];
        bufferIndex = 0;
        bufferFilled = false;
        
        // Reiniciar detección de cruce por cero
        lastVoltage = 0;
        firstZeroCross = true;
        
        // Reiniciar contadores y estado
        periodsCompleted = 0;
        detectedFrequency = 60;
        
        // Reiniciar potencia promedio
        averagePower = 0;
        
        // Reiniciar mediciones instantáneas
        v = 0;
        i = 0;
        
        // Si tienes el scope oculto comentado, también deberías resetearlo:
        // if (hiddenScope != null) hiddenScope.reset();
    }

    // Variables que necesitas agregar
    private double[] periodEnergies = new double[4];
    private double[] periodTimes = new double[4];
    private int bufferIndex = 0;
    private boolean bufferFilled = false;

    @Override
    public void doStep() {
        // Obtener el timeStep del simulador
        double timeStep = sim.timeStep;
        
        double voltage = getVoltageDiff();
        double current = getCurrent();
        double instantPower = voltage * current;
        
        // Acumular energía y tiempo del periodo actual
        currentPeriodEnergy += instantPower * timeStep;
        currentPeriodTime += timeStep;
        
        boolean sobrepasado = (currentPeriodTime > 0.05); //ojo al periodo

        
        // Detectar cruce por cero (de negativo a positivo)
        if ((lastVoltage <= 0 && voltage > 0) || sobrepasado) {

            if (!firstZeroCross || sobrepasado) {
                // Calcular frecuencia del periodo completado
                double periodDuration = currentPeriodTime;
                detectedFrequency = 1.0 / periodDuration;
                
                // Validar frecuencia dentro de rangos razonables
                if (detectedFrequency >= 10 && detectedFrequency <= 5000 || sobrepasado) {
                    // Almacenar el periodo actual en el buffer circular
                    periodEnergies[bufferIndex] = currentPeriodEnergy;
                    periodTimes[bufferIndex] = currentPeriodTime;
                    
                    // Avanzar el índice del buffer
                    bufferIndex = (bufferIndex + 1) % 4;
                    if (bufferIndex == 0) {
                        bufferFilled = true;
                    }
                    
                    // Calcular promedio cada 2 periodos
                    if (periodsCompleted >= 1 && periodsCompleted % 2 == 1) {
                        double totalEnergy = 0;
                        double totalTime = 0;
                        int periodsToAverage = bufferFilled ? 4 : bufferIndex;
                        
                        for (int i = 0; i < periodsToAverage; i++) {
                            totalEnergy += periodEnergies[i];
                            totalTime += periodTimes[i];
                        }
                        
                        averagePower = totalEnergy / totalTime;
                        //GWT.log("Energy, time"+totalEnergy+","+totalTime+","+sim.t);
                    }
                    
                    periodsCompleted++;
                }
            } else {
                // Primer cruce por cero - solo inicializar
                firstZeroCross = false;
            }
            
            // Reiniciar acumuladores para el nuevo periodo
            currentPeriodEnergy = 0;
            currentPeriodTime = 0;
            //GWT.log("reiniciado");

        }
        lastVoltage = voltage;
    }

    double getPower() { return (volts[0] - volts[1]) * getCurrentIntoNode(2); }


    void setCurrent(int vn, double c) {
        // si es la fuente de la rama 2-3, guarda en currents[1]; si no, currents[0]
        currents[(vn == voltSources[1]) ? 1 : 0] = c;
    }

 
    double getCurrentIntoNode(int n) {
        // pares (0,1)->currents[0]; (2,3)->currents[1]
        if (n % 2 == 0) return currents[n/2];
        else            return  -currents[n/2];
    }


    boolean getConnection(int n1, int n2) { return (n1/2) == (n2/2); }
    boolean hasGroundConnection(int n1) { return false; }



    @Override
    void getInfo(String[] arr) {
        arr[0] = "Wattmeter";   // ← SIN ESTO NO SALE INFORMACIÓN

        double v = volts[0] - volts[1];
        double i = getCurrent();
        double pinst = v * i;

        arr[1] = "V = " + getVoltageText(v);
        arr[2] = "I = " + getCurrentText(i);
        arr[3] = "Pinst = " + getUnitText(pinst, "W");
        arr[4] = "Pavg = " + getUnitText(averagePower, "W");
    }



    
    boolean canViewInScope() { return true; }
    double getCurrent() { return currents[1]; }
    double getVoltageDiff() { return volts[0] - volts[1]; }

    boolean canFlipX() { return false; }
    boolean canFlipY() { return false; }
}
