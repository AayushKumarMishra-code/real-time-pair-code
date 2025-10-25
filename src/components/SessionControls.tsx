import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Sparkles, LogIn, Copy, Check } from 'lucide-react';

interface SessionControlsProps {
  onSessionJoined: (sessionCode: string) => void;
  currentSession: string | null;
}

const SessionControls = ({ onSessionJoined, currentSession }: SessionControlsProps) => {
  const [joinCode, setJoinCode] = useState('');
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const generateSessionCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  const createSession = async () => {
    const sessionCode = generateSessionCode();
    
    const { error } = await supabase
      .from('sessions')
      .insert({ session_code: sessionCode });

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to create session',
        variant: 'destructive',
      });
      return;
    }

    onSessionJoined(sessionCode);
    toast({
      title: 'Session Created',
      description: `Session ${sessionCode} created successfully!`,
    });
  };

  const joinSession = async () => {
    if (!joinCode.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a session code',
        variant: 'destructive',
      });
      return;
    }

    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('session_code', joinCode.toUpperCase())
      .single();

    if (error || !data) {
      toast({
        title: 'Error',
        description: 'Session not found',
        variant: 'destructive',
      });
      return;
    }

    onSessionJoined(joinCode.toUpperCase());
    toast({
      title: 'Joined Session',
      description: `Connected to session ${joinCode.toUpperCase()}`,
    });
  };

  const copySessionCode = async () => {
    if (currentSession) {
      await navigator.clipboard.writeText(currentSession);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: 'Copied!',
        description: 'Session code copied to clipboard',
      });
    }
  };

  if (currentSession) {
    return (
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary/50 border border-primary/20">
          <span className="text-muted-foreground text-sm">Session:</span>
          <span className="font-bold text-primary text-lg tracking-wider">{currentSession}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={copySessionCode}
            className="h-8 w-8 p-0 hover:bg-primary/20"
          >
            {copied ? (
              <Check className="h-4 w-4 text-success" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <Button
        onClick={createSession}
        className="bg-gradient-to-r from-primary to-primary-glow hover:opacity-90 transition-opacity"
      >
        <Sparkles className="mr-2 h-4 w-4" />
        Create New Session
      </Button>
      
      <div className="flex items-center gap-2">
        <Input
          placeholder="Enter session code"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && joinSession()}
          className="w-48 bg-secondary border-border"
        />
        <Button
          onClick={joinSession}
          variant="secondary"
          className="hover:bg-secondary/80"
        >
          <LogIn className="mr-2 h-4 w-4" />
          Join
        </Button>
      </div>
    </div>
  );
};

export default SessionControls;