import { useState, useEffect } from 'react';
import SessionControls from '@/components/SessionControls';
import CodeEditor from '@/components/CodeEditor';
import VoiceChat from '@/components/VoiceChat';
import { Code2 } from 'lucide-react';

const Index = () => {
  const [currentSession, setCurrentSession] = useState<string | null>(null);
  const [peerId] = useState(() => Math.random().toString(36).substring(7));

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-primary to-primary-glow">
                <Code2 className="h-6 w-6 text-primary-foreground" />
              </div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                CodeCollab
              </h1>
            </div>

            <SessionControls
              onSessionJoined={setCurrentSession}
              currentSession={currentSession}
            />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        {currentSession ? (
          <CodeEditor sessionCode={currentSession} />
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center space-y-4 max-w-md px-6">
              <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center mb-6">
                <Code2 className="h-10 w-10 text-primary-foreground" />
              </div>
              <h2 className="text-3xl font-bold">Welcome to CodeCollab</h2>
              <p className="text-muted-foreground text-lg">
                Create a new session or join an existing one to start coding together in real-time
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Footer / Status Bar */}
      <footer className="border-t border-border bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {currentSession ? (
                <>
                  <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                  <span className="text-sm text-muted-foreground">
                    Connected to session: <span className="text-foreground font-semibold">{currentSession}</span>
                  </span>
                </>
              ) : (
                <span className="text-sm text-muted-foreground">Not connected to any session</span>
              )}
            </div>

            {currentSession && <VoiceChat sessionCode={currentSession} peerId={peerId} />}
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;