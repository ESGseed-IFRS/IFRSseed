'use client';

import { useState, type ChangeEvent } from 'react';
import { 
  FileText, 
  Send, 
  Settings,
  ShieldCheck
} from 'lucide-react';

// API Key (Placeholder for runtime)
const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY ?? "";

export default function CdpResponsePage() {
  const [loading, setLoading] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [aiResponse, setAiResponse] = useState("");

  const generateReport = async () => {
    if (!prompt) return;
    if (!apiKey) {
      setAiResponse("⚠️ Gemini API 키가 설정되지 않았습니다. `.env.local`에 `NEXT_PUBLIC_GEMINI_API_KEY`를 추가한 뒤 서버를 재시작해주세요.");
      return;
    }
    setLoading(true);
    setAiResponse("");

    const systemPrompt = `당신은 CDP(Carbon Disclosure Project) 대응 전문 AI 에이전트입니다. 
    사용자의 요청을 바탕으로 CDP 질문에 대한 전문적인 답변을 작성하세요.
    CDP의 표준 형식과 요구사항을 준수하며, 데이터 기반의 명확하고 구조화된 답변을 제공하세요.`;

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] }
        })
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setAiResponse(data?.error?.message || "AI 요청이 실패했습니다. (응답 오류)");
        return;
      }
      const text = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("").trim();
      setAiResponse(text || "내용을 생성할 수 없습니다.");
    } catch (_e) {
      setAiResponse("AI 서비스 연결에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <header className="bg-background border-b border-border px-8 py-5 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <div className="bg-primary p-2.5 rounded-xl shadow-seed text-primary-foreground">
            <ShieldCheck size={24}/>
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-foreground">CDP Response Agent</h1>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Carbon Disclosure Project</p>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-8 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="lg:col-span-1 space-y-8">
            <section className="bg-card p-8 rounded-3xl border border-border shadow-sm">
              <div className="flex items-center gap-3 mb-8">
                <div className="bg-primary/10 p-2 rounded-lg text-primary"><Settings size={20}/></div>
                <h2 className="text-lg font-black text-foreground tracking-tight">CDP Report Generator</h2>
              </div>
              
              <div className="space-y-8">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-muted-foreground uppercase block mb-1">CDP 질문 또는 답변 요청</label>
                  <textarea 
                    value={prompt}
                    onChange={(e: ChangeEvent<HTMLTextAreaElement>)=>setPrompt(e.target.value)}
                    className="w-full h-56 bg-muted border border-border rounded-[32px] p-6 text-sm font-medium outline-none focus:ring-4 focus:ring-primary/15 focus:bg-background focus:border-primary/30 transition-all placeholder:text-muted-foreground/60"
                    placeholder="예: 우리 회사의 기후변화 리스크 관리 전략과 거버넌스 체계에 대해 CDP 형식으로 작성해줘."
                  />
                </div>

                <button 
                  onClick={generateReport}
                  disabled={loading || !prompt}
                  className="w-full bg-primary text-primary-foreground py-5 rounded-[24px] font-black text-sm flex items-center justify-center gap-3 hover:bg-primary/90 shadow-seed disabled:opacity-50 disabled:shadow-none transition-all active:scale-[0.98]"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-3 border-white/20 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <Send size={18}/>
                      Generate CDP Response
                    </>
                  )}
                </button>
              </div>
            </section>
          </div>

          <div className="lg:col-span-2">
            <section className="bg-card rounded-[40px] border border-border h-[750px] flex flex-col shadow-sm overflow-hidden border-b-8 border-b-primary">
              <div className="px-10 py-6 border-b border-border bg-muted/40 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse"></div>
                  <span className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">CDP Document Workspace</span>
                </div>
                <div className="flex gap-2">
                  <div className="px-3 py-1 bg-background border border-border rounded-full text-[10px] font-bold text-muted-foreground">Ver 1.2</div>
                </div>
              </div>
              <div className="p-12 flex-1 overflow-y-auto font-serif">
                {aiResponse ? (
                  <div className="max-w-3xl mx-auto">
                    <div className="text-3xl font-black text-foreground mb-8 border-l-4 border-primary pl-6 leading-tight">
                      CDP Disclosure Response
                    </div>
                    <div className="whitespace-pre-wrap text-lg leading-relaxed text-muted-foreground font-sans tracking-tight">
                      {aiResponse}
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground/40">
                    <FileText size={80} strokeWidth={1} className="mb-6 opacity-40"/>
                    <p className="text-lg font-bold text-muted-foreground">Waiting for input...</p>
                    <p className="text-sm">CDP 질문에 대한 전문적인 답변을 생성합니다.</p>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
