import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';
import { Code2, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { FileExplorer } from './FileExplorer';
import { FileTabs } from './FileTabs';

interface FileItem {
  id: string;
  filename: string;
  file_content: string;
  language: string;
}

interface MultiFileEditorProps {
  sessionCode: string;
}

const MultiFileEditor = ({ sessionCode }: MultiFileEditorProps) => {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [openFiles, setOpenFiles] = useState<FileItem[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);
  const lastUpdateTimeRef = useRef(Date.now());
  const { toast } = useToast();

  const loadFiles = async () => {
    const { data } = await supabase
      .from('session_files')
      .select('*')
      .eq('session_code', sessionCode)
      .order('created_at', { ascending: true });

    if (data) {
      setFiles(data);
      
      // Auto-open first file if none are open
      if (data.length > 0 && openFiles.length === 0) {
        const firstFile = data[0];
        setOpenFiles([firstFile]);
        setActiveFileId(firstFile.id);
        setCode(firstFile.file_content || '');
        setLanguage(firstFile.language);
      }
    }
  };

  useEffect(() => {
    loadFiles();

    // Subscribe to file changes
    const channel = supabase
      .channel(`session-files:${sessionCode}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'session_files',
          filter: `session_code=eq.${sessionCode}`,
        },
        (payload: any) => {
          const timeSinceLastUpdate = Date.now() - lastUpdateTimeRef.current;
          
          if (payload.eventType === 'INSERT') {
            loadFiles();
          } else if (payload.eventType === 'DELETE') {
            loadFiles();
            setOpenFiles(prev => prev.filter(f => f.id !== payload.old.id));
            if (activeFileId === payload.old.id) {
              setActiveFileId(null);
              setCode('');
            }
          } else if (payload.eventType === 'UPDATE') {
            if (!isTypingRef.current && timeSinceLastUpdate > 500) {
              loadFiles();
              if (activeFileId === payload.new.id) {
                setCode(payload.new.file_content || '');
                setLanguage(payload.new.language);
              }
            }
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, [sessionCode, activeFileId]);

  const handleFileSelect = (file: FileItem) => {
    // Add to open files if not already open
    if (!openFiles.find(f => f.id === file.id)) {
      setOpenFiles([...openFiles, file]);
    }
    
    setActiveFileId(file.id);
    setCode(file.file_content || '');
    setLanguage(file.language);
    setOutput('');
  };

  const handleFileClose = (fileId: string) => {
    const newOpenFiles = openFiles.filter(f => f.id !== fileId);
    setOpenFiles(newOpenFiles);

    if (activeFileId === fileId) {
      if (newOpenFiles.length > 0) {
        const nextFile = newOpenFiles[newOpenFiles.length - 1];
        setActiveFileId(nextFile.id);
        setCode(nextFile.file_content || '');
        setLanguage(nextFile.language);
      } else {
        setActiveFileId(null);
        setCode('');
        setOutput('');
      }
    }
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!activeFileId) return;

    const newCode = e.target.value;
    setCode(newCode);
    isTypingRef.current = true;
    lastUpdateTimeRef.current = Date.now();

    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }

    updateTimeoutRef.current = setTimeout(async () => {
      await supabase
        .from('session_files')
        .update({ file_content: newCode })
        .eq('id', activeFileId);
      
      setTimeout(() => {
        isTypingRef.current = false;
      }, 200);
    }, 500);
  };

  const handleLanguageChange = async (newLanguage: string) => {
    if (!activeFileId) return;
    
    setLanguage(newLanguage);
    await supabase
      .from('session_files')
      .update({ language: newLanguage })
      .eq('id', activeFileId);
  };

  const runCode = async () => {
    setIsRunning(true);
    setOutput('');

    try {
      if (language === 'javascript') {
        const logs: string[] = [];
        const originalLog = console.log;
        console.log = (...args) => {
          logs.push(args.map(arg => String(arg)).join(' '));
        };

        try {
          const result = eval(code);
          console.log = originalLog;
          
          const outputText = logs.length > 0 ? logs.join('\n') : String(result);
          setOutput(outputText || 'Code executed successfully (no output)');
        } catch (error) {
          console.log = originalLog;
          setOutput(`Error: ${error instanceof Error ? error.message : String(error)}`);
        }
      } else if (['c', 'cpp', 'python', 'java'].includes(language)) {
        const { data, error } = await supabase.functions.invoke('compile-code', {
          body: { code, language }
        });

        if (error) {
          setOutput(`Compilation error: ${error.message}`);
          toast({
            title: "Compilation failed",
            description: error.message,
            variant: "destructive"
          });
        } else if (data) {
          setOutput(data.output || 'Code executed successfully (no output)');
        }
      } else {
        setOutput(`Language ${language} is not supported yet.`);
      }
    } catch (error) {
      setOutput(`Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsRunning(false);
    }
  };

  const activeFile = openFiles.find(f => f.id === activeFileId);

  return (
    <div className="flex-1 flex h-full">
      <div className="w-56">
        <FileExplorer
          sessionCode={sessionCode}
          files={files}
          activeFile={activeFileId}
          onFileSelect={handleFileSelect}
          onFilesChange={loadFiles}
        />
      </div>

      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between gap-2 px-4 py-2 bg-secondary/30 border-b border-border">
          <div className="flex items-center gap-2">
            <Code2 className="h-4 w-4 text-primary" />
            <span className="text-sm text-muted-foreground">Multi-File Editor</span>
          </div>
          <div className="flex items-center gap-2">
            <Select value={language} onValueChange={handleLanguageChange} disabled={!activeFileId}>
              <SelectTrigger className="w-[150px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="javascript">JavaScript</SelectItem>
                <SelectItem value="python">Python</SelectItem>
                <SelectItem value="java">Java</SelectItem>
                <SelectItem value="cpp">C++</SelectItem>
                <SelectItem value="c">C</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={runCode} disabled={isRunning || !activeFileId} size="sm" className="h-8">
              <Play className="h-4 w-4 mr-1" />
              Run Code
            </Button>
          </div>
        </div>

        <FileTabs
          openFiles={openFiles}
          activeFile={activeFileId}
          onFileSelect={handleFileSelect}
          onFileClose={handleFileClose}
        />

        <div className="flex-1 flex flex-col overflow-hidden">
          {activeFileId ? (
            <textarea
              value={code}
              onChange={handleCodeChange}
              className="flex-1 w-full p-4 bg-background text-foreground resize-none focus:outline-none code-editor text-sm leading-relaxed"
              placeholder={`// Editing: ${activeFile?.filename || ''}`}
              spellCheck={false}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Code2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No file selected</p>
                <p className="text-xs mt-1">Create or select a file to start coding</p>
              </div>
            </div>
          )}

          {output && (
            <div className="border-t border-border bg-secondary/10">
              <div className="px-4 py-2 border-b border-border">
                <span className="text-sm font-medium text-foreground">Output:</span>
              </div>
              <pre className="p-4 text-sm text-foreground overflow-auto max-h-48 whitespace-pre-wrap font-mono">
                {output}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MultiFileEditor;
