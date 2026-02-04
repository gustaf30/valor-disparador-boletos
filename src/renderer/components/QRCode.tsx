import React, { useEffect, useState } from 'react';
import { Smartphone, ScanLine } from 'lucide-react';
import QRCodeLib from 'qrcode';

interface QRCodeProps {
  qrData: string;
}

export function QRCode({ qrData }: QRCodeProps) {
  const [qrImage, setQrImage] = useState<string | null>(null);

  useEffect(() => {
    generateQRImage(qrData);
  }, [qrData]);

  const generateQRImage = async (data: string) => {
    try {
      const dataUrl = await QRCodeLib.toDataURL(data, {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      });
      setQrImage(dataUrl);
    } catch (error) {
      console.error('Failed to generate QR code:', error);
    }
  };

  return (
    <div className="qr-container">
      <div className="qr-header">
        <h2>Conectar ao WhatsApp</h2>
        <div className="qr-instruction">
          <Smartphone size={24} className="qr-instruction-icon" />
          <span>Escaneie o codigo QR abaixo com seu WhatsApp para conectar</span>
        </div>
      </div>

      <div className="qr-code">
        {qrImage ? (
          <img src={qrImage} alt="QR Code" width={256} height={256} />
        ) : (
          <div className="skeleton skeleton-qr" />
        )}
      </div>

      <div className="qr-steps">
        <ScanLine size={16} className="qr-steps-icon" />
        <span>WhatsApp &gt; Menu &gt; Aparelhos conectados &gt; Conectar um aparelho</span>
      </div>
    </div>
  );
}
