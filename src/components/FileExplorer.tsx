import { useState } from 'react';
import { File, Folder, Plus, Trash2, FileCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface FileItem {
  id: string;
  filename: string;
  language: string;
}

interface FileExplorerProps {
  sessionCode: string;
  files: FileItem[];
  activeFile: string | null;
  onFileSelect: (file: FileItem) => void;
  onFilesChange: () => void;
}

const getLanguageFromFilename = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase();
  const langMap: Record<string, string> = {
    'js': 'javascript',
    'py': 'python',
    'java': 'java',
    'cpp': 'cpp',
    'c': 'c',
    'ts': 'javascript',
    'jsx': 'javascript',
    'tsx': 'javascript',
  };
  return langMap[ext || ''] || 'javascript';
};

export const FileExplorer = ({ sessionCode, files, activeFile, onFileSelect, onFilesChange }: FileExplorerProps) => {
  const [isCreating, setIsCreating] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const { toast } = useToast();

  const handleCreateFile = async () => {
    if (!newFileName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a filename",
        variant: "destructive"
      });
      return;
    }

    const language = getLanguageFromFilename(newFileName);
    
    const { error } = await supabase
      .from('session_files')
      .insert({
        session_code: sessionCode,
        filename: newFileName,
        file_content: '',
        language
      });

    if (error) {
      if (error.code === '23505') {
        toast({
          title: "Error",
          description: "A file with this name already exists",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to create file",
          variant: "destructive"
        });
      }
      return;
    }

    setNewFileName('');
    setIsCreating(false);
    onFilesChange();
    
    toast({
      title: "Success",
      description: `File "${newFileName}" created`
    });
  };

  const handleDeleteFile = async (fileId: string, filename: string) => {
    const { error } = await supabase
      .from('session_files')
      .delete()
      .eq('id', fileId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete file",
        variant: "destructive"
      });
      return;
    }

    toast({
      title: "Success",
      description: `File "${filename}" deleted`
    });
    onFilesChange();
  };

  return (
    <div className="h-full bg-secondary/20 border-r border-border flex flex-col">
      <div className="p-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Folder className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Files</span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0"
          onClick={() => setIsCreating(true)}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {isCreating && (
          <div className="mb-2 flex gap-1">
            <Input
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              placeholder="filename.ext"
              className="h-7 text-xs"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateFile();
                if (e.key === 'Escape') {
                  setIsCreating(false);
                  setNewFileName('');
                }
              }}
            />
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0"
              onClick={handleCreateFile}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        )}

        {files.length === 0 && !isCreating && (
          <div className="text-xs text-muted-foreground text-center py-4">
            No files yet. Click + to create one.
          </div>
        )}

        {files.map((file) => (
          <div
            key={file.id}
            className={`group flex items-center justify-between px-2 py-1.5 rounded hover:bg-secondary/50 cursor-pointer mb-1 ${
              activeFile === file.id ? 'bg-secondary' : ''
            }`}
            onClick={() => onFileSelect(file)}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <FileCode className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              <span className="text-xs truncate">{file.filename}</span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteFile(file.id, file.filename);
              }}
            >
              <Trash2 className="h-3 w-3 text-destructive" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};
