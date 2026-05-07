import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, X, Send, Bot, User, Sparkles, ChevronDown } from "lucide-react";

interface Mensaje {
  rol: "user" | "assistant";
  texto: string;
  cache?: boolean;
}

export function AsistenteSecof() {
  const [abierto, setAbierto] = useState(false);
  const [mensajes, setMensajes] = useState<Mensaje[]>([
    { rol: "assistant", texto: "¡Hola! Soy el **Asistente SECOF** 👋\n\nPuedo ayudarte con dudas sobre el **Reglamento Interior**, **políticas de Snowtea**, **KPIs**, **procesos operativos** y el uso del sistema SECOF.\n\n¿En qué te puedo ayudar?" }
  ]);
  const [input, setInput] = useState("");
  const [cargando, setCargando] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: sugeridas = [] } = trpc.asistente.sugeridas.useQuery(undefined, { enabled: abierto });
  const GEMINI_KEY = "AIzaSyBHXE9J60OObxS0u4x9wWTjx2MEjF6GW_g";
  const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";
  const CONTEXTO = "Eres el Asistente SECOF de Snowtea. SOLO responde sobre: Reglamento Interior de Trabajo Snowtea, políticas internas, KPIs de los puestos, módulos de SECOF y procesos operativos. Si la pregunta no es sobre estos temas responde: Solo puedo responder sobre Reglamento, políticas Snowtea, KPIs y SECOF. Para otros temas consulta al Director General. NUNCA inventes información que no esté en el reglamento o políticas. Reglamento clave: tolerancia 10min, retardos: 1ro=verbal, 2do=escrito, 3ro=suspensión, vacaciones 1er año=12 días, aguinaldo=15 días antes dic20, faltas graves: robo/violencia/más de 3 ausencias en 30días=rescisión, prohibido descontar salario por daños. KPIs líderes: ventas>35K Patio/0K Portal, score SECOF>85, puntualidad>95%, inventario<5% variación, preparaciones 100%, horario viernes 4pm, conteo físico lunes. Módulos SECOF: Mi Turno, Preparaciones, Checador QR, Rotación Areas, Inventario, Ventas, Recetas, Rentabilidad, Evaluaciones, Empleados.";

  const preguntarGemini = async (pregunta: string) => {
    try {
      const res = await fetch(`${GEMINI_URL}?key=${GEMINI_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${CONTEXTO}

PREGUNTA: ${pregunta}

RESPUESTA:` }] }],
          generationConfig: { maxOutputTokens: 600, temperature: 0.2 },
        }),
      });
      const data = await res.json();
      return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "No pude generar una respuesta. Consulta al Director General.";
    } catch {
      return "No pude conectar con el asistente. Consulta al Director General.";
    }
  };

  const preguntar = trpc.asistente.preguntar.useMutation({
    onSuccess: (data) => {
      setMensajes(m => [...m, { rol: "assistant", texto: data.respuesta, cache: data.fuenteCache }]);
      setCargando(false);
    },
    onError: async () => {
      // Fallback: llamar Gemini directamente desde el frontend
      const respuesta = await preguntarGemini(mensajes[mensajes.length - 1]?.texto ?? "");
      setMensajes(m => [...m, { rol: "assistant", texto: respuesta }]);
      setCargando(false);
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes, cargando]);

  useEffect(() => {
    if (abierto) setTimeout(() => inputRef.current?.focus(), 100);
  }, [abierto]);

  function enviar(texto?: string) {
    const pregunta = texto ?? input.trim();
    if (!pregunta || cargando) return;
    setMensajes(m => [...m, { rol: "user", texto: pregunta }]);
    setInput("");
    setCargando(true);
    preguntar.mutate({ pregunta });
  }

  function renderTexto(texto: string) {
    // Markdown básico: bold, listas, saltos de línea
    return texto
      .split('\n')
      .map((line, i) => {
        const bold = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        const isListItem = line.trim().startsWith('•') || line.trim().startsWith('-') || /^\d+\./.test(line.trim());
        return (
          <span key={i} className={`block ${isListItem ? 'pl-2' : ''} ${line === '' ? 'mt-1' : ''}`}
            dangerouslySetInnerHTML={{ __html: bold }} />
        );
      });
  }

  const mostrarSugeridas = mensajes.length <= 1 && sugeridas.length > 0;

  return (
    <>
      {/* Botón flotante */}
      <button
        onClick={() => setAbierto(o => !o)}
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 ${abierto ? 'bg-gray-700 rotate-0' : 'bg-green-600 hover:bg-green-700 hover:scale-105'}`}
      >
        {abierto ? <X className="w-6 h-6 text-white" /> : <MessageCircle className="w-6 h-6 text-white" />}
        {!abierto && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
            <Sparkles className="w-2.5 h-2.5 text-white" />
          </span>
        )}
      </button>

      {/* Panel del chat */}
      {abierto && (
        <div className="fixed bottom-24 right-6 z-50 w-96 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden"
          style={{ height: '520px' }}>

          {/* Header */}
          <div className="bg-green-600 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-white font-semibold text-sm">Asistente SECOF</p>
                <p className="text-green-100 text-xs">Reglamento · Políticas · KPIs</p>
              </div>
            </div>
            <button onClick={() => setAbierto(false)} className="text-white/70 hover:text-white">
              <ChevronDown className="w-5 h-5" />
            </button>
          </div>

          {/* Mensajes */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50">
            {mensajes.map((m, i) => (
              <div key={i} className={`flex gap-2 ${m.rol === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${m.rol === 'user' ? 'bg-green-100' : 'bg-green-600'}`}>
                  {m.rol === 'user' ? <User className="w-3.5 h-3.5 text-green-700" /> : <Bot className="w-3.5 h-3.5 text-white" />}
                </div>
                <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${m.rol === 'user' ? 'bg-green-600 text-white rounded-tr-none' : 'bg-white border border-gray-200 text-gray-800 rounded-tl-none shadow-sm'}`}>
                  <div className="leading-relaxed">{renderTexto(m.texto)}</div>
                  {m.cache && <p className="text-xs text-gray-400 mt-1">✓ Respuesta instantánea</p>}
                </div>
              </div>
            ))}

            {cargando && (
              <div className="flex gap-2">
                <div className="w-6 h-6 rounded-full bg-green-600 flex items-center justify-center shrink-0">
                  <Bot className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="bg-white border border-gray-200 rounded-xl rounded-tl-none px-3 py-2 shadow-sm">
                  <div className="flex gap-1 items-center h-5">
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            {/* Preguntas sugeridas */}
            {mostrarSugeridas && !cargando && (
              <div className="space-y-1.5">
                <p className="text-xs text-gray-400 text-center">Preguntas frecuentes:</p>
                {sugeridas.map((s, i) => (
                  <button key={i} onClick={() => enviar(s)}
                    className="w-full text-left text-xs bg-white border border-green-200 text-green-700 rounded-lg px-3 py-2 hover:bg-green-50 transition-colors">
                    {s}
                  </button>
                ))}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-gray-100 bg-white">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && enviar()}
                placeholder="Escribe tu pregunta..."
                className="flex-1 h-9 text-sm"
                disabled={cargando}
              />
              <Button size="sm" className="h-9 w-9 p-0 bg-green-600 hover:bg-green-700"
                onClick={() => enviar()} disabled={!input.trim() || cargando}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-gray-400 mt-1.5 text-center">
              Solo responde sobre Reglamento · Políticas · SECOF
            </p>
          </div>
        </div>
      )}
    </>
  );
}
