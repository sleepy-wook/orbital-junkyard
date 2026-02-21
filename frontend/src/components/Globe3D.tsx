"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useTranslation } from "@/lib/i18n";

interface SpaceObjectPoint {
  norad_cat_id: number;
  object_name: string;
  object_type: string;
  country: string;
  lat: number;
  lng: number;
  alt: number; // km
}

interface Globe3DProps {
  objects: SpaceObjectPoint[];
}

const NAVBAR_HEIGHT = 56;
const ROTATION_SPEED = -0.0008; // rad per frame (~2.7°/s → full rotation in ~2.2 min)
const IDLE_RESUME_MS = 5000;

const TYPE_LEGEND = [
  { type: "PAYLOAD", key: "globe.payload_active", colorClass: "bg-green-500" },
  { type: "DEBRIS", key: "globe.debris", colorClass: "bg-red-500" },
  { type: "ROCKET BODY", key: "globe.rocket_body", colorClass: "bg-yellow-500" },
] as const;

const ORBIT_BANDS = [
  { label: "LEO", alt: 2000, rgb: [0, 210, 211] },
  { label: "MEO", alt: 20200, rgb: [100, 149, 237] },
  { label: "GEO", alt: 35786, rgb: [186, 85, 211] },
] as const;

function getColor(objectType: string): [number, number, number, number] {
  switch (objectType?.toUpperCase()) {
    case "PAYLOAD":
      return [34, 197, 94, 200];
    case "DEBRIS":
      return [239, 68, 68, 180];
    case "ROCKET BODY":
      return [234, 179, 8, 200];
    default:
      return [148, 163, 184, 160];
  }
}

export default function Globe3D({ objects }: Globe3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<InstanceType<typeof import("cesium").Viewer> | null>(null);
  const initRef = useRef(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pointsByType = useRef<Record<string, any[]>>({});

  const [selectedObject, setSelectedObject] = useState<SpaceObjectPoint | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set());
  const [legendOpen, setLegendOpen] = useState(false);
  const { t } = useTranslation();

  const handleSelect = useCallback((obj: SpaceObjectPoint | null) => {
    setSelectedObject(obj);
  }, []);

  const toggleType = useCallback((type: string) => {
    setHiddenTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      const points = pointsByType.current[type];
      if (points) {
        const visible = !next.has(type);
        for (const p of points) p.show = visible;
      }
      viewerRef.current?.scene.requestRender();
      return next;
    });
  }, []);

  useEffect(() => {
    if (initRef.current || !containerRef.current) return;
    initRef.current = true;

    const container = containerRef.current;
    let rafId: number | null = null;
    let idleTimer: number | null = null;
    let cesiumCanvas: HTMLCanvasElement | null = null;
    let pauseFn: (() => void) | null = null;

    function setSize() {
      container.style.width = `${window.innerWidth}px`;
      container.style.height = `${window.innerHeight - NAVBAR_HEIGHT}px`;
    }
    setSize();

    async function initCesium() {
      // Load Cesium widget CSS
      if (!document.getElementById("cesium-css")) {
        const link = document.createElement("link");
        link.id = "cesium-css";
        link.rel = "stylesheet";
        link.href = "/cesium/Widgets/widgets.css";
        document.head.appendChild(link);
        await new Promise<void>((resolve) => {
          link.onload = () => resolve();
          setTimeout(resolve, 500);
        });
      }

      const Cesium = await import("cesium");
      (window as unknown as Record<string, unknown>).CESIUM_BASE_URL = "/cesium";

      const token = process.env.NEXT_PUBLIC_CESIUM_TOKEN;
      if (token) Cesium.Ion.defaultAccessToken = token;

      const baseLayerOption = token
        ? {
            baseLayer: Cesium.ImageryLayer.fromProviderAsync(
              Cesium.IonImageryProvider.fromAssetId(3845)
            ),
          }
        : {
            baseLayer: Cesium.ImageryLayer.fromProviderAsync(
              Cesium.TileMapServiceImageryProvider.fromUrl(
                Cesium.buildModuleUrl("Assets/Textures/NaturalEarthII")
              )
            ),
          };

      if (!containerRef.current) return;

      const viewer = new Cesium.Viewer(container, {
        baseLayerPicker: false,
        geocoder: false,
        homeButton: false,
        sceneModePicker: false,
        navigationHelpButton: false,
        animation: false,
        timeline: false,
        fullscreenButton: false,
        vrButton: false,
        infoBox: false,
        selectionIndicator: false,
        msaaSamples: 1,
        ...baseLayerOption,
      });

      viewerRef.current = viewer;
      viewer.resize();

      // ── Performance optimizations ──
      viewer.scene.requestRenderMode = true;
      viewer.scene.maximumRenderTimeChange = Infinity;
      viewer.scene.globe.maximumScreenSpaceError = 4;
      viewer.scene.fog.enabled = false;
      if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = false;
      viewer.scene.globe.showGroundAtmosphere = false;
      viewer.scene.globe.enableLighting = false;
      viewer.scene.backgroundColor = Cesium.Color.BLACK;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (viewer.scene as any).fxaa = false;

      // ── Points (grouped by type for filtering) ──
      const pointCollection = viewer.scene.primitives.add(
        new Cesium.PointPrimitiveCollection()
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const grouped: Record<string, any[]> = {};

      for (const obj of objects) {
        const color = getColor(obj.object_type);
        const size = obj.object_type === "PAYLOAD" ? 3 : 2;
        const position = Cesium.Cartesian3.fromDegrees(obj.lng, obj.lat, obj.alt * 1000);

        const point = pointCollection.add({
          position,
          color: new Cesium.Color(color[0] / 255, color[1] / 255, color[2] / 255, color[3] / 255),
          pixelSize: size,
        });

        (point as Record<string, unknown>)._objectData = obj;
        const type = obj.object_type?.toUpperCase() || "UNKNOWN";
        if (!grouped[type]) grouped[type] = [];
        grouped[type].push(point);
      }
      pointsByType.current = grouped;

      // ── Orbital band rings (LEO / MEO / GEO) ──
      for (const band of ORBIT_BANDS) {
        const r = Cesium.Ellipsoid.WGS84.maximumRadius + band.alt * 1000;
        const positions: InstanceType<typeof Cesium.Cartesian3>[] = [];
        for (let deg = 0; deg <= 360; deg += 2) {
          const rad = Cesium.Math.toRadians(deg);
          positions.push(new Cesium.Cartesian3(r * Math.cos(rad), r * Math.sin(rad), 0));
        }
        const bandColor = new Cesium.Color(
          band.rgb[0] / 255, band.rgb[1] / 255, band.rgb[2] / 255, 0.35
        );
        viewer.entities.add({
          polyline: { positions, width: 1.5, material: bandColor },
        });
        viewer.entities.add({
          position: new Cesium.Cartesian3(r + 200000, 0, 0),
          label: {
            text: `${band.label}  ${band.alt.toLocaleString()} km`,
            font: "11px monospace",
            fillColor: new Cesium.Color(
              band.rgb[0] / 255, band.rgb[1] / 255, band.rgb[2] / 255, 0.9
            ),
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 3,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            pixelOffset: new Cesium.Cartesian2(0, -10),
            scaleByDistance: new Cesium.NearFarScalar(5e5, 1, 5e7, 0.4),
            distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 6e7),
          },
        });
      }

      // ── Click handler ──
      const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
      handler.setInputAction(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (event: any) => {
          const picked = viewer.scene.pick(event.position);
          if (picked?.primitive?._objectData) {
            handleSelect(picked.primitive._objectData);
          } else {
            handleSelect(null);
          }
        },
        Cesium.ScreenSpaceEventType.LEFT_CLICK
      );

      // ── Hover highlight ──
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let hoveredPoint: any = null;
      let hoveredOrigSize = 0;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let hoveredOrigColor: any = null;
      const canvas = viewer.scene.canvas;

      handler.setInputAction(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (movement: any) => {
          // Restore previous
          if (hoveredPoint) {
            hoveredPoint.pixelSize = hoveredOrigSize;
            hoveredPoint.color = hoveredOrigColor;
            hoveredPoint.outlineColor = Cesium.Color.TRANSPARENT;
            hoveredPoint.outlineWidth = 0;
            hoveredPoint = null;
          }
          const picked = viewer.scene.pick(movement.endPosition);
          if (picked?.primitive?._objectData) {
            hoveredPoint = picked.primitive;
            hoveredOrigSize = hoveredPoint.pixelSize;
            hoveredOrigColor = hoveredPoint.color.clone();
            // Brighten original color + glow outline
            hoveredPoint.pixelSize = 8;
            hoveredPoint.color = new Cesium.Color(
              Math.min(hoveredOrigColor.red * 1.5, 1),
              Math.min(hoveredOrigColor.green * 1.5, 1),
              Math.min(hoveredOrigColor.blue * 1.5, 1),
              1.0
            );
            hoveredPoint.outlineColor = Cesium.Color.WHITE.withAlpha(0.7);
            hoveredPoint.outlineWidth = 3;
            canvas.style.cursor = "pointer";
          } else {
            canvas.style.cursor = "";
          }
          viewer.scene.requestRender();
        },
        Cesium.ScreenSpaceEventType.MOUSE_MOVE
      );

      // ── Camera initial view ──
      viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(127, 37, 20000000),
      });

      // ── Auto-rotation ──
      let rotating = true;

      function startLoop() {
        function loop() {
          if (!rotating || viewer.isDestroyed()) {
            rafId = null;
            return;
          }
          viewer.camera.rotate(Cesium.Cartesian3.UNIT_Z, ROTATION_SPEED);
          viewer.scene.requestRender();
          rafId = requestAnimationFrame(loop);
        }
        if (!rafId) rafId = requestAnimationFrame(loop);
      }

      pauseFn = () => {
        rotating = false;
        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = window.setTimeout(() => {
          rotating = true;
          startLoop();
        }, IDLE_RESUME_MS);
      };

      cesiumCanvas = viewer.scene.canvas;
      cesiumCanvas.addEventListener("pointerdown", pauseFn);
      cesiumCanvas.addEventListener("wheel", pauseFn);
      startLoop();

      setIsLoading(false);

      // ── Resize ──
      const onResize = () => {
        setSize();
        viewer.resize();
      };
      window.addEventListener("resize", onResize);
      (viewerRef as unknown as Record<string, unknown>)._onResize = onResize;
    }

    initCesium();

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (idleTimer) clearTimeout(idleTimer);
      if (cesiumCanvas && pauseFn) {
        cesiumCanvas.removeEventListener("pointerdown", pauseFn);
        cesiumCanvas.removeEventListener("wheel", pauseFn);
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const onResize = (viewerRef as any)?._onResize;
      if (onResize) window.removeEventListener("resize", onResize);
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
      initRef.current = false;
    };
  }, [objects, handleSelect]);

  return (
    <div
      id="globe-wrapper"
      style={{
        position: "fixed",
        top: NAVBAR_HEIGHT,
        left: 0,
        right: 0,
        bottom: 0,
        overflow: "hidden",
      }}
    >
      <div ref={containerRef} />

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background">
          <div className="text-center">
            <div className="w-12 h-12 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-foreground/60 text-sm">{t("globe.loading")}</p>
          </div>
        </div>
      )}

      {/* Legend with filter toggles */}
      <div className="absolute bottom-4 left-3 md:bottom-8 md:left-8 bg-card/90 backdrop-blur-md border border-card-border rounded-xl p-3 md:p-4">
        <button
          className="md:hidden flex items-center gap-2 w-full text-left"
          onClick={() => setLegendOpen((v) => !v)}
        >
          <p className="text-xs text-foreground/50 font-medium uppercase tracking-wider">
            {t("globe.object_types")}
          </p>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" className={`text-foreground/40 transition-transform ${legendOpen ? "rotate-180" : ""}`}>
            <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
        <p className="hidden md:block text-xs text-foreground/50 mb-2 font-medium uppercase tracking-wider">
          {t("globe.object_types")}
        </p>
        <div className={`${legendOpen ? "block" : "hidden"} md:block mt-2 md:mt-0`}>
          <div className="flex flex-col gap-1.5">
            {TYPE_LEGEND.map(({ type, key, colorClass }) => {
              const hidden = hiddenTypes.has(type);
              return (
                <button
                  key={type}
                  onClick={() => toggleType(type)}
                  className="flex items-center gap-2 group text-left"
                >
                  <div
                    className={`w-3 h-3 rounded-full transition-opacity ${colorClass} ${
                      hidden ? "opacity-20" : ""
                    }`}
                  />
                  <span
                    className={`text-xs md:text-sm transition-opacity ${
                      hidden
                        ? "text-foreground/30 line-through"
                        : "text-foreground/70 group-hover:text-foreground"
                    }`}
                  >
                    {t(key)}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="border-t border-card-border/30 mt-3 pt-3">
            <p className="text-xs text-foreground/50 mb-2 font-medium uppercase tracking-wider">
              {t("globe.orbital_bands")}
            </p>
            <div className="flex flex-col gap-1.5">
              {ORBIT_BANDS.map((band) => (
                <div key={band.label} className="flex items-center gap-2">
                  <div
                    className="w-4 h-0.5 rounded-full"
                    style={{ background: `rgb(${band.rgb.join(",")})` }}
                  />
                  <span className="text-xs text-foreground/60 font-medium">{band.label}</span>
                  <span className="text-xs text-foreground/30">
                    {band.alt.toLocaleString()} km
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Selected object info */}
      {selectedObject && (
        <div className="absolute top-4 right-3 md:top-6 md:right-8 bg-card/95 backdrop-blur-md border border-card-border rounded-xl p-4 md:p-5 w-56 md:w-auto md:min-w-64">
          <div className="flex justify-between items-start mb-3">
            <h3 className="font-bold text-base">{selectedObject.object_name}</h3>
            <button
              onClick={() => setSelectedObject(null)}
              className="text-foreground/40 hover:text-foreground text-xl leading-none ml-4"
            >
              x
            </button>
          </div>
          <div className="space-y-2 text-sm text-foreground/60">
            <p>
              <span className="text-foreground/40">{t("globe.norad_id")}</span>{" "}
              {selectedObject.norad_cat_id}
            </p>
            <p>
              <span className="text-foreground/40">{t("globe.type")}</span>{" "}
              <span
                className={
                  selectedObject.object_type === "PAYLOAD"
                    ? "text-green-400"
                    : selectedObject.object_type === "DEBRIS"
                    ? "text-red-400"
                    : "text-yellow-400"
                }
              >
                {selectedObject.object_type}
              </span>
            </p>
            <p>
              <span className="text-foreground/40">{t("globe.country")}</span>{" "}
              {selectedObject.country}
            </p>
            <p>
              <span className="text-foreground/40">{t("globe.altitude")}</span>{" "}
              {selectedObject.alt.toFixed(0)} km
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
