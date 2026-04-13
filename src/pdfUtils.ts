import { jsPDF } from 'jspdf';
import { format } from 'date-fns';
import { IzinSakit } from './types';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

export const terbilang = (n: number): string => {
  const words = ["", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Delapan", "Sembilan", "Sepuluh", "Sebelas"];
  if (n < 12) return words[n];
  if (n < 20) return terbilang(n - 10) + " Belas";
  if (n < 100) return terbilang(Math.floor(n / 10)) + " Puluh " + terbilang(n % 10);
  return n.toString();
};

export const generatePermitPDF = async (permit: IzinSakit) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // --- DESIGN: Border & Background ---
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.1);
  doc.rect(5, 5, 200, 287); // Page border
  
  // --- HEADER (Centered without Logo for Stability) ---
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('KEMENTERIAN SOSIAL REPUBLIK INDONESIA', 105, 18, { align: 'center' });
  doc.setFontSize(16);
  doc.text('SEKOLAH RAKYAT MENENGAH ATAS 24 KEDIRI', 105, 25, { align: 'center' });
  doc.setFontSize(12);
  doc.setTextColor(79, 70, 229); // Indigo color
  doc.text('UNIT PELAYANAN KESEHATAN SEKOLAH (UKS)', 105, 32, { align: 'center' });
  
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Gedung Balai Pengembangan Kompetensi Aparatur Sipil Negara', 105, 38, { align: 'center' });
  doc.text('Gg. 2 Bulusari Utara, Bulusari, Kec. Tarokan, Kab. Kediri, Jawa Timur', 105, 43, { align: 'center' });
  doc.text(`Email: srma24kediri@gmail.com   |   Kode Pos: 64152`, 105, 48, { align: 'center' });
  
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.8);
  doc.line(20, 52, 190, 52);
  doc.setLineWidth(0.2);
  doc.line(20, 53.5, 190, 53.5);

  // --- TITLE ---
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  const title = permit.tipe === 'sakit' ? 'SURAT KETERANGAN SAKIT' : 'SURAT IZIN UMUM / LAINNYA';
  doc.text(title, 105, 65, { align: 'center' });
  doc.setLineWidth(0.5);
  doc.line(60, 66.5, 150, 66.5);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Nomor : ${permit.nomor_surat}`, 105, 72, { align: 'center' });

  // --- RECIPIENT ---
  doc.setFontSize(11);
  doc.text('Kepada Yth.', 20, 85);
  doc.setFont('helvetica', 'bold');
  doc.text(`Bapak/Ibu ${permit.nama_wali_kelas}`, 20, 91);
  doc.text(`Wali Kelas ${permit.kelas}`, 20, 96);
  doc.setFont('helvetica', 'normal');
  doc.text('SRMA 24 Kediri', 20, 101);
  doc.text('di Tempat', 20, 106);

  // --- CONTENT ---
  doc.text('Dengan hormat,', 20, 118);
  const openingText = permit.tipe === 'sakit' 
    ? `Menerangkan bahwa berdasarkan hasil pemeriksaan medis di Unit Pelayanan Kesehatan Sekolah (UKS) SRMA 24 Kediri, siswa tersebut di bawah ini:`
    : `Menerangkan bahwa berdasarkan permohonan izin yang diajukan kepada Wali Asuh SRMA 24 Kediri, siswa tersebut di bawah ini:`;
  doc.text(openingText, 20, 124, { maxWidth: 170 });

  // Details Table-like structure
  const startY = 138;
  const lineGap = 8;
  const labelX = 25;
  const valueX = 65;

  const details = [
    { label: 'Nama Lengkap', value: permit.nama_siswa.toUpperCase() },
    { label: 'Kelas / Jurusan', value: permit.kelas },
    { label: permit.tipe === 'sakit' ? 'Diagnosa Medis' : 'Alasan Izin', value: (permit.tipe === 'sakit' ? permit.diagnosa : permit.alasan) || '-' },
    { label: 'Lokasi Istirahat', value: permit.catatan_kamar || (permit.tipe === 'sakit' ? 'Kamar Santri' : 'Luar Sekolah') }
  ];

  details.forEach((item, index) => {
    const y = startY + (index * lineGap);
    doc.setFont('helvetica', 'bold');
    doc.text(item.label, labelX, y);
    doc.setFont('helvetica', 'normal');
    doc.text(`:  ${item.value}`, valueX, y);
    doc.setDrawColor(230, 230, 230);
    doc.line(valueX, y + 1.5, 190, y + 1.5);
  });

  // Body Text
  doc.setFont('helvetica', 'normal');
  const bodyY = startY + (details.length * lineGap) + 10;
  const tglMulaiStr = permit.tgl_mulai && typeof permit.tgl_mulai.toDate === 'function' ? format(permit.tgl_mulai.toDate(), 'dd MMMM yyyy') : '-';
  const tglSelesaiStr = permit.tgl_selesai && typeof permit.tgl_selesai.toDate === 'function' ? format(permit.tgl_selesai.toDate(), 'dd MMMM yyyy') : '-';
  
  const bodyText = permit.tipe === 'sakit'
    ? `Dinyatakan dalam kondisi kurang sehat dan memerlukan istirahat total selama ${permit.jumlah_hari} (${terbilang(permit.jumlah_hari)}) hari, terhitung mulai tanggal ${tglMulaiStr} sampai dengan ${tglSelesaiStr}.`
    : `Diberikan izin untuk meninggalkan kegiatan sekolah / beristirahat selama ${permit.jumlah_hari} (${terbilang(permit.jumlah_hari)}) hari, terhitung mulai tanggal ${tglMulaiStr} sampai dengan ${tglSelesaiStr} dikarenakan alasan tersebut di atas.`;
  
  doc.text(bodyText, 20, bodyY, { maxWidth: 170, align: 'justify', lineHeightFactor: 1.5 });

  doc.text('Demikian surat keterangan ini diberikan agar dapat dipergunakan sebagaimana mestinya. Atas perhatian Bapak/Ibu, kami sampaikan terima kasih.', 20, bodyY + 25, { maxWidth: 170, align: 'justify' });

  // --- SIGNATURES ---
  const footerY = 225;
  
  // QR Codes
  const qrWaliAsuh = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=VERIFIED_WALI_ASUH_${permit.id}_${permit.nama_wali_asuh}`;
  const qrPerawat = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=VERIFIED_PERAWAT_${permit.id}_${permit.nama_dokter}`;
  
  doc.addImage(qrWaliAsuh, 'PNG', 45, footerY + 10, 20, 20);
  doc.addImage(qrPerawat, 'PNG', 140, footerY + 10, 20, 20);

  // Wali Asuh
  doc.setFont('helvetica', 'normal');
  doc.text('Mengetahui,', 55, footerY, { align: 'center' });
  doc.text('Wali Asuh', 55, footerY + 5, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.text(permit.nama_wali_asuh || '-', 55, footerY + 38, { align: 'center' });
  doc.setLineWidth(0.2);
  doc.line(35, footerY + 39, 75, footerY + 39);
  
  // Perawat / Pembuat
  doc.setFont('helvetica', 'normal');
  const tglSuratStr = permit.tgl_surat && typeof permit.tgl_surat.toDate === 'function' ? format(permit.tgl_surat.toDate(), 'dd MMMM yyyy') : '-';
  doc.text(`Kediri, ${tglSuratStr}`, 150, footerY, { align: 'center' });
  doc.text(permit.tipe === 'sakit' ? 'Perawat Pemeriksa,' : 'Pembuat Izin,', 150, footerY + 5, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.text(permit.nama_dokter || permit.nama_wali_asuh || '-', 150, footerY + 38, { align: 'center' });
  doc.line(130, footerY + 39, 170, footerY + 39);

  // Security Note
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text('Dokumen ini sah dan ditandatangani secara elektronik melalui Sistem Perizinan Sakit SRMA 24.', 105, 275, { align: 'center' });
  doc.text('Verifikasi keaslian dapat dilakukan dengan memindai QR Code di atas.', 105, 279, { align: 'center' });

  // --- OUTPUT ---
  const fileName = `Surat_Sakit_${permit.nama_siswa.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
  
  if (Capacitor.isNativePlatform()) {
    try {
      const pdfBase64 = doc.output('datauristring').split(',')[1];
      
      // Write to a unique path in Cache directory to avoid conflicts
      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: pdfBase64,
        directory: Directory.Cache
      });

      // Share the file - this allows downloading, saving, or sending via WhatsApp/Email
      await Share.share({
        title: 'Surat Keterangan Sakit',
        text: `Surat Izin Sakit - ${permit.nama_siswa}`,
        url: savedFile.uri,
        dialogTitle: 'Simpan atau Bagikan Surat Izin'
      });
    } catch (error) {
      console.error("Capacitor Share Error:", error);
      // Fallback for mobile if sharing fails
      doc.save(fileName);
    }
  } else {
    // Standard web download
    doc.save(fileName);
  }
};

