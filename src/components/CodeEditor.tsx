import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';
import { Code2 } from 'lucide-react';

interface CodeEditorProps {
  sessionCode: string;
}

const CodeEditor = ({ sessionCode }: CodeEditorProps) => {
  const [code, setCode] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  return (
    <div className="flex-1 flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-2 bg-secondary/30 border-b border-border">
        <Code2 className="h-4 w-4 text-primary" />
        <span className="text-sm text-muted-foreground">Collaborative Editor</span>
      </div>
      <textarea
        value={code}
        onChange={handleCodeChange}
        className="flex-1 w-full p-4 bg-background text-foreground resize-none focus:outline-none code-editor text-sm leading-relaxed"
        placeholder="// Start coding together..."
        spellCheck={false}
      />
    </div>
  );
};

export default CodeEditor;