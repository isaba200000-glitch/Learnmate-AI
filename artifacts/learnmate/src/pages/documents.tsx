import { useState } from "react";
import { useAuth } from "@clerk/react";
import { motion } from "framer-motion";
import { MotionStagger, MotionStaggerItem } from "@/components/motion";
import {
  useListDocuments,
  useGetDocument,
  getListDocumentsQueryKey,
  getGetDocumentQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FileText, Upload, File, Loader2, CheckCircle2, BookOpen, BarChart2, Hash } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useQueryClient } from "@tanstack/react-query";
import { apiUrl } from "@/lib/api-url";

export default function DocumentsPage() {
  const { toast } = useToast();
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isAnalysing, setIsAnalysing] = useState(false);

  // Upload form state
  const [docTitle,   setDocTitle]   = useState("");
  const [docContent, setDocContent] = useState("");

  const { data: documents, isLoading } = useListDocuments({
    query: { queryKey: getListDocumentsQueryKey() },
  });

  const { data: selectedDoc, isLoading: isDocLoading } = useGetDocument(
    selectedDocId as number,
    { query: { enabled: !!selectedDocId, queryKey: getGetDocumentQueryKey(selectedDocId as number) } }
  );

  const handleUpload = async () => {
    if (!docTitle.trim() || !docContent.trim()) {
      toast({ title: "Please enter a title and some content.", variant: "destructive" });
      return;
    }
    try {
      const token = await getToken();
      const res = await fetch(apiUrl("/documents"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          title: docTitle.trim(),
          filename: `${docTitle.trim().toLowerCase().replace(/\s+/g, "-")}.txt`,
          content: docContent.trim(),
        }),
      });
      if (!res.ok) throw new Error("Upload failed");
      const doc = await res.json();
      queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey() });
      setIsUploadOpen(false);
      setDocTitle(""); setDocContent("");
      setSelectedDocId(doc.id);
      toast({ title: "Document saved!", description: "Click 'Analyse Document' to extract insights." });
    } catch {
      toast({ title: "Failed to save document. Please try again.", variant: "destructive" });
    }
  };

  const handleAnalyse = async () => {
    if (!selectedDocId) return;
    setIsAnalysing(true);
    try {
      const token = await getToken();
      const res = await fetch(apiUrl(`/documents/${selectedDocId}/process`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) throw new Error("Analysis failed");
      queryClient.invalidateQueries({ queryKey: getGetDocumentQueryKey(selectedDocId) });
      queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey() });
      toast({ title: "Analysis complete!", description: "Readability stats and keywords are ready." });
    } catch {
      toast({ title: "Analysis failed. Please try again.", variant: "destructive" });
    } finally {
      setIsAnalysing(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, filter: "blur(8px)" }}
      animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-8"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Document Analyser</h1>
          <p className="text-muted-foreground mt-1">
            Paste your notes or text to get readability stats and top keywords.
          </p>
        </div>
        <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-full shadow-sm">
              <Upload className="h-4 w-4 mr-2" /> Add Document
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add Document</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Title <span className="text-destructive">*</span></label>
                <Input
                  value={docTitle}
                  onChange={e => setDocTitle(e.target.value)}
                  placeholder="e.g. Chapter 3 – The Water Cycle"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Content <span className="text-destructive">*</span>
                  <span className="text-muted-foreground font-normal"> — paste your notes or text here</span>
                </label>
                <textarea
                  value={docContent}
                  onChange={e => setDocContent(e.target.value)}
                  placeholder="Paste your textbook excerpt, lecture notes, or any study material here…"
                  rows={10}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  {docContent.split(/\s+/).filter(Boolean).length.toLocaleString()} words
                </p>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setIsUploadOpen(false)}>Cancel</Button>
                <Button onClick={handleUpload} disabled={!docTitle.trim() || !docContent.trim()}>
                  Save Document
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-6 md:min-h-[520px]">
        {/* Document List */}
        <Card className="glass-card flex flex-col max-h-[45vh] md:max-h-[75vh]">
          <CardHeader className="border-b border-border/50 pb-4 bg-secondary/20 shrink-0">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" /> Your Library
            </CardTitle>
          </CardHeader>
          <ScrollArea className="flex-1 overflow-auto">
            {isLoading ? (
              <div className="p-3 space-y-1">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-xl">
                    <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-4 w-16 rounded-md" />
                    </div>
                  </div>
                ))}
              </div>
            ) : !documents?.length ? (
              <div className="p-8 text-center text-muted-foreground">
                <File className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm">No documents yet.</p>
                <p className="text-xs mt-1">Add your first document above.</p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {documents.map(doc => (
                  <button
                    key={doc.id}
                    onClick={() => setSelectedDocId(doc.id)}
                    className={`w-full text-left p-3 rounded-xl transition-all flex items-start gap-3 ${
                      selectedDocId === doc.id
                        ? "bg-primary text-primary-foreground shadow-md"
                        : "hover:bg-secondary border border-transparent"
                    }`}
                  >
                    <div className={`mt-0.5 rounded-lg p-2 shrink-0 ${selectedDocId === doc.id ? "bg-primary-foreground/20" : "bg-primary/10 text-primary"}`}>
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{doc.title}</p>
                      <Badge
                        variant={doc.status === "processed" ? "default" : "secondary"}
                        className={`mt-1 text-[10px] ${selectedDocId === doc.id ? "bg-primary-foreground/20 text-primary-foreground border-none" : ""}`}
                      >
                        {doc.status === "processed" ? "Analysed" : doc.status}
                      </Badge>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </Card>

        {/* Viewer */}
        <Card className="glass-card flex flex-col overflow-y-auto min-h-[400px] md:max-h-[75vh]">
          {selectedDocId ? (
            isDocLoading ? (
              <div className="p-8 space-y-6">
                <Skeleton className="h-8 w-3/4" />
                <Skeleton className="h-32 w-full rounded-xl" />
                <Skeleton className="h-48 w-full rounded-xl" />
              </div>
            ) : selectedDoc ? (
              <div className="flex flex-col h-full">
                <CardHeader className="border-b border-border/50 bg-secondary/10 shrink-0">
                  <CardTitle className="text-2xl">{selectedDoc.title}</CardTitle>
                  <CardDescription className="flex items-center gap-2">
                    <File className="h-3.5 w-3.5" /> {selectedDoc.filename}
                    {selectedDoc.status === "processed" && (
                      <Badge variant="default" className="ml-2">Analysed</Badge>
                    )}
                  </CardDescription>
                </CardHeader>

                <ScrollArea className="flex-1 p-6">
                  <div className="max-w-3xl space-y-8 overflow-x-hidden break-words [overflow-wrap:anywhere]">
                    {/* Analysis results */}
                    {selectedDoc.status === "processed" && selectedDoc.summary ? (
                      <MotionStagger className="max-w-3xl space-y-8 overflow-x-hidden break-words [overflow-wrap:anywhere]">
                        <MotionStaggerItem>
                          <div className="space-y-3">
                            <h3 className="text-lg font-semibold flex items-center gap-2">
                              <BarChart2 className="h-5 w-5 text-blue-500" /> Readability Report
                            </h3>
                            <div className="p-5 rounded-2xl bg-blue-500/5 border border-blue-500/20 text-sm leading-relaxed">
                              {selectedDoc.summary}
                            </div>
                          </div>
                        </MotionStaggerItem>

                        {selectedDoc.keyConcepts && selectedDoc.keyConcepts.length > 0 && (
                          <MotionStaggerItem>
                            <div className="space-y-3">
                              <h3 className="text-lg font-semibold flex items-center gap-2">
                                <Hash className="h-5 w-5 text-emerald-500" /> Top Keywords
                              </h3>
                              <div className="flex flex-wrap gap-2">
                                {selectedDoc.keyConcepts.map((kw, i) => (
                                  <Badge
                                    key={i}
                                    variant="secondary"
                                    className="text-sm px-3 py-1 rounded-full font-medium"
                                  >
                                    {kw}
                                  </Badge>
                                ))}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Most frequently occurring content words (stop words excluded).
                              </p>
                            </div>
                          </MotionStaggerItem>
                        )}

                        <MotionStaggerItem>
                          <div className="space-y-3">
                            <h3 className="text-lg font-semibold flex items-center gap-2">
                              <BookOpen className="h-5 w-5 text-amber-500" /> Document Content
                            </h3>
                            <div className="p-5 rounded-2xl bg-secondary/30 border border-border/50 text-sm leading-relaxed whitespace-pre-wrap max-h-80 overflow-y-auto">
                              {selectedDoc.content}
                            </div>
                          </div>
                        </MotionStaggerItem>
                      </MotionStagger>
                    ) : (
                      <div className="text-center py-12 space-y-4">
                        <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                          <BarChart2 className="h-10 w-10 text-primary opacity-60" />
                        </div>
                        <div>
                          <h3 className="text-xl font-semibold mb-2">Ready to analyse</h3>
                          <p className="text-muted-foreground text-sm max-w-md mx-auto">
                            Run the analysis to get a readability score, estimated reading time, and the top keywords in your document.
                          </p>
                        </div>
                        <Button onClick={handleAnalyse} disabled={isAnalysing} size="lg" className="rounded-full">
                          {isAnalysing ? (
                            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analysing…</>
                          ) : (
                            <><CheckCircle2 className="h-4 w-4 mr-2" /> Analyse Document</>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            ) : null
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-center p-8 text-muted-foreground bg-secondary/5">
              <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center mb-6 ring-1 ring-primary/20">
                <FileText className="h-12 w-12 text-primary opacity-80" />
              </div>
              <h3 className="text-2xl font-bold text-foreground mb-2 tracking-tight">Analyse your study materials</h3>
              <p className="max-w-md mx-auto mb-8 text-sm">
                Paste textbook notes, essays, or any study text. We'll calculate readability grade, reading time, and extract the most important keywords.
              </p>
              <Button onClick={() => setIsUploadOpen(true)} className="rounded-full">
                <Upload className="h-4 w-4 mr-2" /> Add Your First Document
              </Button>
            </div>
          )}
        </Card>
      </div>
    </motion.div>
  );
}
