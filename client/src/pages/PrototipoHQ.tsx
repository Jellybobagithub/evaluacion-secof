import { ExternalLink, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PrototipoHQ() {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b bg-white shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-green-600 flex items-center justify-center">
            <Monitor className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-900">Prototipo Sistema Snowtea HQ</h1>
            <p className="text-xs text-gray-500">Vista previa interactiva del sistema integral de gestión de franquicia</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => window.open("/prototipo-hq", "_blank")}
        >
          <ExternalLink className="w-4 h-4" />
          Abrir en pantalla completa
        </Button>
      </div>

      {/* Iframe */}
      <div className="flex-1 overflow-hidden">
        <iframe
          src="/prototipo-hq"
          className="w-full h-full border-0"
          title="Prototipo Snowtea HQ"
        />
      </div>
    </div>
  );
}
