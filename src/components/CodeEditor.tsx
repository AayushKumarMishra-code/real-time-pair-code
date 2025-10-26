import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';
import { Code2, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

interface CodeEditorProps {
  sessionCode: string;
}

const CodeEditor = ({ sessionCode }: CodeEditorProps) => {
  const [code, setCode] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [language, setLanguage] = useState('javascript');
  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Load initial code
    const loadCode = async () => {
      const { data } = await supabase
        .from('sessions')
        .select('code_content')
        .eq('session_code', sessionCode)
        .single();

      if (data) {
        setCode(data.code_content || '');
      }
    };

    loadCode();

    // Subscribe to changes
    const channel = supabase
      .channel(`session:${sessionCode}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sessions',
          filter: `session_code=eq.${sessionCode}`,
        },
        (payload: any) => {
          if (!isUpdating) {
            setCode(payload.new.code_content || '');
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
  }, [sessionCode]);

  const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newCode = e.target.value;
    setCode(newCode);
    setIsUpdating(true);

    // Debounce updates to database
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }

    updateTimeoutRef.current = setTimeout(async () => {
      await supabase
        .from('sessions')
        .update({ code_content: newCode })
        .eq('session_code', sessionCode);
      
      setIsUpdating(false);
    }, 300);
  };

  const runCode = () => {
    setIsRunning(true);
    setOutput('');

    try {
      if (language === 'javascript') {
        // Capture console.log output
        const logs: string[] = [];
        const originalLog = console.log;
        console.log = (...args) => {
          logs.push(args.map(arg => String(arg)).join(' '));
        };

        try {
          // Execute the code
          const result = eval(code);
          console.log = originalLog;
          
          const outputText = logs.length > 0 ? logs.join('\n') : String(result);
          setOutput(outputText || 'Code executed successfully (no output)');
        } catch (error) {
          console.log = originalLog;
          setOutput(`Error: ${error instanceof Error ? error.message : String(error)}`);
        }
      } else {
        setOutput(`Execution for ${language} requires an external API. Currently only JavaScript is supported in the browser.`);
        toast({
          title: "Language not supported",
          description: `${language} execution requires API integration`,
          variant: "destructive"
        });
      }
    } catch (error) {
      setOutput(`Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full">
      <div className="flex items-center justify-between gap-2 px-4 py-2 bg-secondary/30 border-b border-border">
        <div className="flex items-center gap-2">
          <Code2 className="h-4 w-4 text-primary" />
          <span className="text-sm text-muted-foreground">Collaborative Editor</span>
        </div>
        <div className="flex items-center gap-2">
          <Select value={language} onValueChange={setLanguage}>
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
          <Button onClick={runCode} disabled={isRunning} size="sm" className="h-8">
            <Play className="h-4 w-4 mr-1" />
            Run Code
          </Button>
        </div>
      </div>
      <div className="flex-1 flex flex-col overflow-hidden">
        <textarea
          value={code}
          onChange={handleCodeChange}
          className="flex-1 w-full p-4 bg-background text-foreground resize-none focus:outline-none code-editor text-sm leading-relaxed"
          placeholder="// Start coding together..."
          spellCheck={false}
        />
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
  );
};

export default CodeEditor;