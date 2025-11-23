/**
 * Voice Input Component
 * Ermöglicht Spracheingabe mit Whisper API (Deutsch)
 * Max 60 Sekunden Aufnahme
 */

import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Loader, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  language?: string;
  maxDuration?: number; // in seconds
  className?: string;
}

export function VoiceInput({
  onTranscript,
  language = 'de',
  maxDuration = 60,
  className
}: VoiceInputProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const { toast } = useToast();

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());

        // Reset timer
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
        setRecordingTime(0);

        // Transcribe
        await transcribeAudio(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          const newTime = prev + 1;
          if (newTime >= maxDuration) {
            stopRecording();
            toast({
              title: 'Maximale Aufnahmezeit erreicht',
              description: `Die Aufnahme wurde nach ${maxDuration} Sekunden automatisch beendet.`,
            });
          }
          return newTime;
        });
      }, 1000);

    } catch (error) {
      console.error('Fehler beim Starten der Aufnahme:', error);
      toast({
        title: 'Mikrofon-Zugriff verweigert',
        description: 'Bitte erlauben Sie den Zugriff auf das Mikrofon.',
        variant: 'destructive',
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);

    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    setIsProcessing(true);

    try {
      const formData = new FormData();
      formData.append('file', audioBlob, 'recording.webm');
      formData.append('language', language);

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Transkription fehlgeschlagen');
      }

      const { text } = await response.json();

      onTranscript(text);

      toast({
        title: 'Transkription erfolgreich',
        description: 'Der Text wurde erfolgreich umgewandelt.',
      });
    } catch (error) {
      console.error('Transkription error:', error);
      toast({
        title: 'Transkription fehlgeschlagen',
        description: error instanceof Error ? error.message : 'Ein unbekannter Fehler ist aufgetreten',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`flex items-center gap-2 ${className || ''}`}>
      <Button
        type="button"
        variant={isRecording ? 'destructive' : 'outline'}
        size="icon"
        onClick={isRecording ? stopRecording : startRecording}
        disabled={isProcessing}
        title={isRecording ? 'Aufnahme stoppen' : 'Aufnahme starten'}
      >
        {isProcessing ? (
          <Loader className="h-4 w-4 animate-spin" />
        ) : isRecording ? (
          <MicOff className="h-4 w-4" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
      </Button>

      {isRecording && (
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <span className="text-sm text-muted-foreground font-mono">
            {formatTime(recordingTime)} / {formatTime(maxDuration)}
          </span>
        </div>
      )}

      {isProcessing && (
        <span className="text-sm text-muted-foreground">
          Transkribiere...
        </span>
      )}
    </div>
  );
}

/**
 * Info Text Component for Voice Input
 */
export function VoiceInputInfo({ className = "" }: { className?: string } = {}) {
  return (
    <div className={`flex items-start gap-2 text-sm text-muted-foreground mt-2 ${className}`}>
      <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
      <p>
        Klicken Sie auf das Mikrofon-Symbol und sprechen Sie Ihren Text.
        Die Aufnahme wird automatisch nach 60 Sekunden beendet.
      </p>
    </div>
  );
}
