'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode';
import { Button } from './button';
import { X, Camera } from 'lucide-react';

interface QRScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onScanFailure?: (error: string) => void;
  onClose?: () => void;
  title?: string;
}

export function QRScanner({ onScanSuccess, onScanFailure, onClose, title = "Escanear QR Code" }: QRScannerProps) {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const [isScanning, setIsScanning] = useState(true);

  useEffect(() => {
    const scannerId = "qr-reader";
    
    // Configura o scanner
    scannerRef.current = new Html5QrcodeScanner(
      scannerId,
      { 
        fps: 10, 
        qrbox: { width: 250, height: 250 },
        supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
        rememberLastUsedCamera: true
      },
      false
    );

    const handleScanSuccess = (decodedText: string) => {
      // Evita múltiplas chamadas se já estiver processando
      if (!isScanning) return;
      
      setIsScanning(false);
      // Pausa o scanner após sucesso
      scannerRef.current?.pause(true);
      
      // Reproduz som de bip (opcional, melhora UX)
      try {
        const audio = new Audio('/beep.mp3');
        audio.play().catch(e => console.log('Audio play failed', e));
      } catch {}

      onScanSuccess(decodedText);
    };

    const handleScanFailure = (error: string) => {
      if (onScanFailure) {
        onScanFailure(error);
      }
    };

    scannerRef.current.render(handleScanSuccess, handleScanFailure);

    // Cleanup
    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(error => {
          console.error("Failed to clear html5QrcodeScanner. ", error);
        });
      }
    };
  }, [onScanSuccess, onScanFailure, isScanning]);

  return (
    <div className="fixed inset-0 z-50 bg-background/80  flex items-center justify-center p-4">
      <div className="bg-card w-full max-w-md rounded-md shadow-sm overflow-hidden border border-border flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2 text-foreground font-semibold">
            <Camera className="w-5 h-5 text-primary" />
            {title}
          </div>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full w-8 h-8">
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
        
        {/* Scanner Body */}
        <div className="p-4 bg-black relative flex flex-col items-center justify-center min-h-[300px]">
          <div id="qr-reader" className="w-full text-white [&_button]:bg-primary [&_button]:text-primary-foreground [&_button]:px-4 [&_button]:py-2 [&_button]:rounded-md [&_button]:mt-2 [&_button]:mb-2 [&_select]:text-black [&_select]:p-2 [&_select]:rounded-md [&_select]:w-full [&_select]:mb-4" />
          
          <div className="absolute bottom-4 left-0 right-0 text-center text-white/70 text-sm">
            Posicione o QR Code do capacete na área de leitura
          </div>
        </div>
      </div>
    </div>
  );
}
