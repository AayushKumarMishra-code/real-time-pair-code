import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { code, language } = await req.json();

    console.log(`Compiling ${language} code:`, code.substring(0, 100));

    // Map our language names to Wandbox compiler names
    const compilerMap: Record<string, string> = {
      'c': 'gcc-head-c',
      'cpp': 'gcc-head',
      'python': 'cpython-head',
      'java': 'openjdk-head',
    };

    const compiler = compilerMap[language];
    if (!compiler) {
      return new Response(
        JSON.stringify({ error: `Unsupported language: ${language}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call Wandbox API
    const response = await fetch('https://wandbox.org/api/compile.json', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        compiler: compiler,
        code: code,
        save: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Wandbox API error: ${response.statusText}`);
    }

    const result = await response.json();
    console.log('Compilation result:', result);

    // Format output
    let output = '';
    
    if (result.compiler_error) {
      output = `Compilation Error:\n${result.compiler_error}`;
    } else if (result.program_error) {
      output = `Runtime Error:\n${result.program_error}`;
    } else if (result.program_output) {
      output = result.program_output;
    } else {
      output = 'Code executed successfully (no output)';
    }

    return new Response(
      JSON.stringify({ output, status: result.status }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error compiling code:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
