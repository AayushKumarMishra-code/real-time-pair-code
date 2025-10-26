import { useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Mic, MicOff, Phone, PhoneOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { RealtimeChannel } from '@supabase/supabase-js';

interface VoiceChatProps {
  sessionCode: string;
  peerId: string;
}

const VoiceChat = ({ sessionCode, peerId }: VoiceChatProps) => {
  const [isMuted, setIsMuted] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const iceCandidateQueueRef = useRef<RTCIceCandidateInit[]>([]);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Create and configure remote audio element
    const audio = new Audio();
    audio.autoplay = true;
    remoteAudioRef.current = audio;

    return () => {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = null;
        remoteAudioRef.current = null;
      }
    };
  }, []);

  const configuration: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject',
      },
      {
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject',
      },
    ],
    iceCandidatePoolSize: 10,
    iceTransportPolicy: 'all',
  };

  useEffect(() => {
    const channel = supabase
      .channel(`webrtc:${sessionCode}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'webrtc_signals',
          filter: `session_code=eq.${sessionCode}`,
        },
        async (payload: any) => {
          const signal = payload.new;
          
          // Ignore our own signals
          if (signal.from_peer === peerId) return;

          console.log('Received signal:', signal.signal_type);

          if (signal.signal_type === 'offer') {
            await handleOffer(signal.signal_data);
          } else if (signal.signal_type === 'answer') {
            await handleAnswer(signal.signal_data);
          } else if (signal.signal_type === 'ice-candidate') {
            await handleIceCandidate(signal.signal_data);
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      disconnect();
      supabase.removeChannel(channel);
    };
  }, [sessionCode, peerId]);

  const sendSignal = async (type: string, data: any) => {
    await supabase.from('webrtc_signals').insert({
      session_code: sessionCode,
      from_peer: peerId,
      signal_type: type,
      signal_data: data,
    });
  };

  const createPeerConnection = () => {
    const pc = new RTCPeerConnection(configuration);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal('ice-candidate', event.candidate);
      }
    };

    pc.ontrack = (event) => {
      console.log('Received remote track:', event.streams[0]);
      if (remoteAudioRef.current && event.streams[0]) {
        remoteAudioRef.current.srcObject = event.streams[0];
        remoteAudioRef.current.volume = 1.0;
        remoteAudioRef.current.play().catch(e => {
          console.error('Error playing audio:', e);
          // Try again after user interaction
          document.addEventListener('click', () => {
            remoteAudioRef.current?.play();
          }, { once: true });
        });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('Connection state:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        setIsConnected(true);
        setIsConnecting(false);
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        setIsConnected(false);
        setIsConnecting(false);
        toast({
          title: 'Connection Lost',
          description: 'Voice call disconnected',
          variant: 'destructive',
        });
      }
    };

    return pc;
  };

  const startCall = async () => {
    try {
      setIsConnecting(true);
      
      // Get microphone access with better error handling
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          }
        });
      } catch (err: any) {
        console.error('Microphone access error:', err);
        setIsConnecting(false);
        toast({
          title: 'Microphone Access Denied',
          description: 'Please allow microphone access in your browser settings and try again.',
          variant: 'destructive',
        });
        return;
      }

      localStreamRef.current = stream;

      // Create peer connection
      const pc = createPeerConnection();
      peerConnectionRef.current = pc;

      // Add local stream to peer connection
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      // Create and send offer
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
      });
      await pc.setLocalDescription(offer);
      await sendSignal('offer', offer);

      toast({
        title: 'Calling...',
        description: 'Waiting for peer to connect',
      });
    } catch (error) {
      console.error('Error starting call:', error);
      setIsConnecting(false);
      toast({
        title: 'Error',
        description: 'Failed to start call. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleOffer = async (offer: RTCSessionDescriptionInit) => {
    try {
      if (!localStreamRef.current) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            }
          });
          localStreamRef.current = stream;
        } catch (err) {
          console.error('Microphone access error:', err);
          toast({
            title: 'Microphone Access Denied',
            description: 'Please allow microphone access to receive calls.',
            variant: 'destructive',
          });
          return;
        }
      }

      const pc = createPeerConnection();
      peerConnectionRef.current = pc;

      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer({
        offerToReceiveAudio: true,
      });
      await pc.setLocalDescription(answer);
      await sendSignal('answer', answer);
      
      setIsConnecting(true);
      
      // Process queued ICE candidates
      while (iceCandidateQueueRef.current.length > 0) {
        const candidate = iceCandidateQueueRef.current.shift();
        if (candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
      }
    } catch (error) {
      console.error('Error handling offer:', error);
    }
  };

  const handleAnswer = async (answer: RTCSessionDescriptionInit) => {
    try {
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.setRemoteDescription(
          new RTCSessionDescription(answer)
        );
        
        // Process queued ICE candidates
        while (iceCandidateQueueRef.current.length > 0) {
          const candidate = iceCandidateQueueRef.current.shift();
          if (candidate) {
            await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
          }
        }
      }
    } catch (error) {
      console.error('Error handling answer:', error);
    }
  };

  const handleIceCandidate = async (candidate: RTCIceCandidateInit) => {
    try {
      if (peerConnectionRef.current && peerConnectionRef.current.remoteDescription) {
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      } else {
        // Queue the candidate if remote description is not set yet
        iceCandidateQueueRef.current.push(candidate);
      }
    } catch (error) {
      console.error('Error handling ICE candidate:', error);
    }
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const disconnect = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    iceCandidateQueueRef.current = [];
    setIsConnected(false);
    setIsConnecting(false);
    setIsMuted(false);
  };

  return (
    <div className="flex items-center gap-3">
      {!isConnected && !isConnecting && (
        <Button
          onClick={startCall}
          className="bg-success hover:bg-success/90"
        >
          <Phone className="mr-2 h-4 w-4" />
          Start Voice Call
        </Button>
      )}

      {(isConnected || isConnecting) && (
        <>
          <Button
            onClick={toggleMute}
            variant={isMuted ? 'destructive' : 'secondary'}
            className="hover:opacity-90"
          >
            {isMuted ? (
              <>
                <MicOff className="mr-2 h-4 w-4" />
                Unmute
              </>
            ) : (
              <>
                <Mic className="mr-2 h-4 w-4" />
                Mute
              </>
            )}
          </Button>

          <Button
            onClick={disconnect}
            variant="destructive"
          >
            <PhoneOff className="mr-2 h-4 w-4" />
            End Call
          </Button>

          {isConnecting && (
            <span className="text-sm text-muted-foreground animate-pulse">
              Connecting...
            </span>
          )}

          {isConnected && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <span className="text-sm text-success">Connected</span>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default VoiceChat;