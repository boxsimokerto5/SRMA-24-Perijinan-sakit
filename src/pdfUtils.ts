import { jsPDF } from 'jspdf';
import { format } from 'date-fns';
import { IzinSakit, Memorandum, LaptopRequest, HPRequest, HealthCheckProposal, SarprasReport, MonthlyReport, ProgressRecord, EvaluationNote, DormitoryIncident, PinjamHP, Ketidakhadiran, JurnalKeperawatan, PenangananJurnal, StudentCounseling, DormitoryLoss, LaporanPerkembanganSiswa, KunjunganOrangTua, SKPReport, SOP, JadwalTausiyah, Siswa, AbsenHarianRecord } from './types';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import QRCode from 'qrcode';
import autoTable from 'jspdf-autotable';
import { id } from 'date-fns/locale';
import { compressImage } from './imageUtils';

export const getImageDataUrl = async (url: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = url;
  });
};

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
  const headerSubTitle = permit.tipe === 'umum' ? 'WALI ASUH' : 
                        permit.tipe === 'catatan' ? 'WALI KELAS / GURU MAPEL' :
                        'UNIT PELAYANAN KESEHATAN SEKOLAH (UKS)';
  doc.text(headerSubTitle, 105, 32, { align: 'center' });
  
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
  const title = permit.tipe === 'sakit' ? 'SURAT KETERANGAN SAKIT' : 
                permit.tipe === 'umum' ? 'SURAT IZIN UMUM / LAINNYA' : 
                'SURAT CATATAN PERKEMBANGAN SISWA';
  doc.text(title, 105, 65, { align: 'center' });
  doc.setLineWidth(0.5);
  doc.line(60, 66.5, 150, 66.5);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Nomor : ${permit.nomor_surat}`, 105, 72, { align: 'center' });

  // --- RECIPIENT ---
  doc.setFontSize(11);
  if (permit.tipe === 'catatan') {
    doc.text('Kepada Yth.', 20, 85);
    doc.setFont('helvetica', 'bold');
    doc.text(`Bapak/Ibu Wali Asuh ananda ${permit.nama_siswa}`, 20, 91);
    doc.setFont('helvetica', 'normal');
    doc.text('SRMA 24 Kediri', 20, 96);
    doc.text('di Tempat', 20, 101);
  } else {
    doc.text('Kepada Yth.', 20, 85);
    doc.setFont('helvetica', 'bold');
    doc.text(`Bapak/Ibu ${permit.nama_wali_kelas}`, 20, 91);
    doc.text(`Wali Kelas ${permit.kelas}`, 20, 96);
    doc.setFont('helvetica', 'normal');
    doc.text('SRMA 24 Kediri', 20, 101);
    doc.text('di Tempat', 20, 106);
  }

  // --- CONTENT ---
  doc.text('Dengan hormat,', 20, 118);
  const openingText = permit.tipe === 'sakit' 
    ? `Menerangkan bahwa berdasarkan hasil pemeriksaan medis di Unit Pelayanan Kesehatan Sekolah (UKS) SRMA 24 Kediri, siswa tersebut di bawah ini:`
    : permit.tipe === 'umum'
    ? `Saya yang bertanda tangan di bawah ini, selaku Wali Asuh (Orang Tua Asuh) dari siswa tersebut di bawah ini:`
    : `Menerangkan bahwa berdasarkan hasil pengamatan dan evaluasi belajar di SRMA 24 Kediri, terdapat catatan penting bagi siswa tersebut di bawah ini:`;
  doc.text(openingText, 20, 124, { maxWidth: 170 });

  // Details Table-like structure
  const startY = 138;
  const lineGap = 8;
  const labelX = 25;
  const valueX = 65;

  const details = [
    { label: 'Nama Lengkap', value: (permit.nama_siswa || '').toUpperCase() },
    { label: 'Kelas / Jurusan', value: permit.kelas },
    { 
      label: permit.tipe === 'sakit' ? 'Diagnosa Medis' : (permit.tipe === 'umum' ? 'Alasan Izin' : 'Isi Catatan'), 
      value: (permit.tipe === 'sakit' ? permit.diagnosa : (permit.tipe === 'umum' ? permit.alasan : permit.isi_catatan)) || '-' 
    }
  ];

  if (permit.tipe === 'sakit') {
    details.push({ 
      label: 'Lokasi / Catatan', 
      value: permit.catatan_kamar || 'Kamar Peserta Didik' 
    });
  }

  let currentY = startY;
  details.forEach((item) => {
    doc.setFont('helvetica', 'bold');
    doc.text(item.label, labelX, currentY);
    
    doc.setFont('helvetica', 'normal');
    const valueText = item.value || '-';
    doc.text(':', valueX - 3, currentY);
    
    const maxWidth = 190 - valueX;
    
    // Use jspdf text with maxWidth and left align for more stable wrapping
    doc.text(valueText, valueX, currentY, { 
      maxWidth: maxWidth, 
      align: 'left' 
    });
    
    // Calculate how much space this took
    const dimensions = doc.getTextDimensions(valueText, { maxWidth: maxWidth });
    const rowHeight = Math.max(lineGap, dimensions.h + 2);
    
    doc.setDrawColor(230, 230, 230);
    // Draw line below based on actual height
    doc.line(valueX, currentY + rowHeight - 2, 190, currentY + rowHeight - 2);
    
    currentY += rowHeight + 3;
  });

  // Body Text
  doc.setFont('helvetica', 'normal');
  const bodyY = currentY + 5;
  
  if (permit.tipe !== 'catatan') {
    const tglMulaiStr = permit.tgl_mulai && typeof permit.tgl_mulai.toDate === 'function' ? format(permit.tgl_mulai.toDate(), 'dd MMMM yyyy') : '-';
    const tglSelesaiStr = permit.tgl_selesai && typeof permit.tgl_selesai.toDate === 'function' ? format(permit.tgl_selesai.toDate(), 'dd MMMM yyyy') : '-';
    
    const bodyText = permit.tipe === 'sakit'
      ? `Dinyatakan dalam kondisi kurang sehat dan memerlukan istirahat total selama ${permit.jumlah_hari} (${terbilang(permit.jumlah_hari!)}) hari, terhitung mulai tanggal ${tglMulaiStr} sampai dengan ${tglSelesaiStr}.`
      : `Memohonkan izin kepada Bapak/Ibu Wali Kelas agar siswa tersebut di atas diberikan izin untuk tidak mengikuti kegiatan belajar mengajar selama ${permit.jumlah_hari} (${terbilang(permit.jumlah_hari!)}) hari, terhitung mulai tanggal ${tglMulaiStr} sampai dengan ${tglSelesaiStr} dikarenakan alasan tersebut di atas.`;
    
    doc.text(bodyText, 20, bodyY, { maxWidth: 170, align: 'justify', lineHeightFactor: 1.5 });
  } else {
    const bodyText = `Catatan ini diberikan sebagai bentuk perhatian dan koordinasi antara Wali Kelas dan Wali Asuh demi kebaikan proses belajar siswa yang bersangkutan. Mohon untuk dapat diperhatikan dan ditindaklanjuti sebagaimana mestinya.`;
    doc.text(bodyText, 20, bodyY, { maxWidth: 170, align: 'justify', lineHeightFactor: 1.5 });
  }

  doc.text('Demikian surat keterangan ini diberikan agar dapat dipergunakan sebagaimana mestinya. Atas perhatian Bapak/Ibu, kami sampaikan terima kasih.', 20, bodyY + 25, { maxWidth: 170, align: 'justify' });

  // --- SIGNATURES ---
  const footerY = 225;
  
  if (permit.tipe === 'sakit') {
    // QR Codes for Sickness Permit
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
    
    // Perawat
    doc.setFont('helvetica', 'normal');
    const tglSuratStr = permit.tgl_surat && typeof permit.tgl_surat.toDate === 'function' ? format(permit.tgl_surat.toDate(), 'dd MMMM yyyy') : '-';
    doc.text(`Kediri, ${tglSuratStr}`, 150, footerY, { align: 'center' });
    doc.text('Perawat Pemeriksa,', 150, footerY + 5, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.text(permit.nama_dokter || '-', 150, footerY + 38, { align: 'center' });
    doc.line(130, footerY + 39, 170, footerY + 39);
  } else if (permit.tipe === 'umum') {
    // Single Signature for General Permit
    const qrWaliAsuh = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=VERIFIED_WALI_ASUH_${permit.id}_${permit.nama_wali_asuh}`;
    doc.addImage(qrWaliAsuh, 'PNG', 140, footerY + 10, 20, 20);

    doc.setFont('helvetica', 'normal');
    const tglSuratStr = permit.tgl_surat && typeof permit.tgl_surat.toDate === 'function' ? format(permit.tgl_surat.toDate(), 'dd MMMM yyyy') : '-';
    doc.text(`Kediri, ${tglSuratStr}`, 150, footerY, { align: 'center' });
    doc.text('Wali Asuh (Orang Tua),', 150, footerY + 5, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.text(permit.nama_wali_asuh || '-', 150, footerY + 38, { align: 'center' });
    doc.setLineWidth(0.2);
    doc.line(130, footerY + 39, 170, footerY + 39);
  } else if (permit.tipe === 'catatan') {
    // Single Signature for Catatan (Wali Kelas only)
    const qrWaliKelas = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=VERIFIED_WALI_KELAS_${permit.id}_${permit.nama_wali_kelas}`;
    doc.addImage(qrWaliKelas, 'PNG', 140, footerY + 10, 20, 20);

    doc.setFont('helvetica', 'normal');
    const tglSuratStr = permit.tgl_surat && typeof permit.tgl_surat.toDate === 'function' ? format(permit.tgl_surat.toDate(), 'dd MMMM yyyy') : '-';
    doc.text(`Kediri, ${tglSuratStr}`, 150, footerY, { align: 'center' });
    doc.text('Wali Kelas,', 150, footerY + 5, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.text(permit.nama_wali_kelas || '-', 150, footerY + 38, { align: 'center' });
    doc.setLineWidth(0.2);
    doc.line(130, footerY + 39, 170, footerY + 39);
  }

  // Security Note
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text('Dokumen ini sah dan ditandatangani secara elektronik melalui Sistem Perizinan Sakit SRMA 24.', 105, 275, { align: 'center' });
  doc.text('Verifikasi keaslian dapat dilakukan dengan memindai QR Code di atas.', 105, 279, { align: 'center' });

  // --- OUTPUT ---
  const typeLabel = permit.tipe === 'sakit' ? 'Surat_Sakit' : 
                    permit.tipe === 'umum' ? 'Ijin_Umum' : 
                    'Catatan_Siswa';
  const fileName = `${typeLabel}_${(permit.nama_siswa || '').replace(/\s+/g, '_')}_${Date.now()}.pdf`;
  
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

export const generateSummaryReportPDF = async (permits: IzinSakit[], rangeLabel: string, userName: string = 'SRMA 24 KEDIRI', roleTitle: string = 'Kepala Sekolah') => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // --- DESIGN: Border & Header ---
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.1);
  doc.rect(5, 5, 200, 287);
  
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('KEMENTERIAN SOSIAL REPUBLIK INDONESIA', 105, 18, { align: 'center' });
  doc.setFontSize(16);
  doc.text('SEKOLAH RAKYAT MENENGAH ATAS 24 KEDIRI', 105, 25, { align: 'center' });
  doc.setFontSize(12);
  doc.setTextColor(79, 70, 229);
  doc.text('LAPORAN REKAPITULASI PERIZINAN SISWA', 105, 32, { align: 'center' });
  
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.8);
  doc.line(20, 45, 190, 45);

  // --- REPORT INFO ---
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Periode Laporan : ${rangeLabel}`, 20, 55);
  doc.text(`Tanggal Cetak   : ${format(new Date(), 'dd MMMM yyyy, HH:mm')}`, 20, 60);
  doc.text(`Total Data      : ${permits.length} Kejadian`, 20, 65);

  // --- TABLE ---
  const tableData = permits.map((p, index) => [
    (index + 1).toString(),
    p.nama_siswa || '',
    p.kelas || '',
    (p.tipe || '').toUpperCase(),
    (p.diagnosa || p.alasan || p.isi_catatan || '-'),
    p.nama_dokter || '-',
    p.tgl_surat && typeof p.tgl_surat.toDate === 'function' ? format(p.tgl_surat.toDate(), 'dd/MM/yy') : '-'
  ]);

  autoTable(doc, {
    startY: 75,
    head: [['NO', 'NAMA SISWA', 'KELAS', 'TIPE', 'DIAGNOSA / KETERANGAN', 'DOKTER PEMERIKSA', 'TANGGAL']],
    body: tableData,
    theme: 'grid',
    styles: {
      overflow: 'linebreak',
      cellPadding: 2,
      fontSize: 8,
      valign: 'top',
      font: 'helvetica'
    },
    headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { textColor: [40, 40, 40] },
    columnStyles: {
      0: { cellWidth: 8 },
      1: { cellWidth: 35 },
      2: { cellWidth: 12 },
      3: { cellWidth: 15 },
      4: { cellWidth: 'auto', halign: 'left' },
      5: { cellWidth: 28 },
      6: { cellWidth: 22 }
    },
    margin: { left: 20, right: 20 }
  });

  const finalY = (doc as any).lastAutoTable.finalY;

  // --- SIGNATURE ---
  const footerY = Math.min(finalY + 15, 230);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Kediri, ' + format(new Date(), 'dd MMMM yyyy'), 150, footerY, { align: 'center' });
  doc.text(`${roleTitle},`, 150, footerY + 5, { align: 'center' });
  
  // QR Signature
  const qrData = `LAPORAN_VERIFIED_BY_${userName}_${format(new Date(), 'yyyyMMddHHmm')}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrData)}`;
  doc.addImage(qrUrl, 'PNG', 137, footerY + 10, 25, 25);

  doc.setFont('helvetica', 'bold');
  doc.text(userName, 150, footerY + 45, { align: 'center' });
  doc.line(125, footerY + 46, 175, footerY + 46);

  // --- OUTPUT ---
  const fileName = `Laporan_Rekap_${rangeLabel.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
  
  if (Capacitor.isNativePlatform()) {
    try {
      const pdfBase64 = doc.output('datauristring').split(',')[1];
      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: pdfBase64,
        directory: Directory.Cache
      });
      await Share.share({
        title: 'Laporan Rekapitulasi SRMA 24',
        text: `Laporan Rekapitulasi - ${rangeLabel}`,
        url: savedFile.uri,
        dialogTitle: 'Simpan atau Bagikan Laporan'
      });
    } catch (error) {
      console.error("Capacitor Share Error:", error);
      doc.save(fileName);
    }
  } else {
    doc.save(fileName);
  }
};

export const generateHealthCheckSummaryReportPDF = async (proposals: HealthCheckProposal[], rangeLabel: string, userName: string = 'SRMA 24 KEDIRI') => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // --- DESIGN: Border & Header ---
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.1);
  doc.rect(5, 5, 200, 287);
  
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('KEMENTERIAN SOSIAL REPUBLIK INDONESIA', 105, 18, { align: 'center' });
  doc.setFontSize(16);
  doc.text('SEKOLAH RAKYAT MENENGAH ATAS 24 KEDIRI', 105, 25, { align: 'center' });
  doc.setFontSize(12);
  doc.setTextColor(219, 39, 119); // Pink/Rose color for health
  doc.text('LAPORAN REKAPITULASI USULAN CEK KESEHATAN', 105, 32, { align: 'center' });
  
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.8);
  doc.line(20, 45, 190, 45);

  // --- REPORT INFO ---
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Periode Laporan : ${rangeLabel}`, 20, 55);
  doc.text(`Tanggal Cetak   : ${format(new Date(), 'dd MMMM yyyy, HH:mm')}`, 20, 60);
  doc.text(`Total Data      : ${proposals.length} Usulan`, 20, 65);

  // --- TABLE ---
  const tableData = proposals.map((p, index) => [
    (index + 1).toString(),
    p.proposer_name || '',
    p.asrama || '-',
    p.daftar_siswa.join(', '),
    p.tgl_usulan && typeof p.tgl_usulan.toDate === 'function' ? format(p.tgl_usulan.toDate(), 'dd/MM/yy') : '-',
    p.status.toUpperCase()
  ]);

  autoTable(doc, {
    startY: 75,
    head: [['NO', 'PENGUSUL', 'ASRAMA', 'DAFTAR SISWA', 'TANGGAL', 'STATUS']],
    body: tableData,
    theme: 'grid',
    styles: {
      overflow: 'linebreak',
      cellPadding: 2,
      fontSize: 8,
      valign: 'top',
      font: 'helvetica'
    },
    headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { textColor: [40, 40, 40] },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 30 },
      2: { cellWidth: 20 },
      3: { cellWidth: 'auto', halign: 'left' },
      4: { cellWidth: 20 },
      5: { cellWidth: 20 }
    },
    margin: { left: 20, right: 20 }
  });

  const finalY = (doc as any).lastAutoTable.finalY;

  // --- SIGNATURE ---
  const footerY = Math.min(finalY + 15, 230);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Kediri, ' + format(new Date(), 'dd MMMM yyyy'), 150, footerY, { align: 'center' });
  doc.text('Petugas Kesehatan,', 150, footerY + 5, { align: 'center' });
  
  // QR Signature
  const qrData = `HEALTH_SUMMARY_VERIFIED_BY_${userName}_${format(new Date(), 'yyyyMMddHHmm')}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrData)}`;
  doc.addImage(qrUrl, 'PNG', 137, footerY + 10, 25, 25);

  doc.setFont('helvetica', 'bold');
  doc.text(userName, 150, footerY + 45, { align: 'center' });
  doc.line(125, footerY + 46, 175, footerY + 46);

  // --- OUTPUT ---
  const fileName = `Rekap_Usulan_Kesehatan_${rangeLabel.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
  
  if (Capacitor.isNativePlatform()) {
    try {
      const pdfBase64 = doc.output('datauristring').split(',')[1];
      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: pdfBase64,
        directory: Directory.Cache
      });
      await Share.share({
        title: 'Rekapitulasi Usulan Kesehatan',
        text: `Rekapitulasi Usulan Kesehatan - ${rangeLabel}`,
        url: savedFile.uri,
        dialogTitle: 'Simpan atau Bagikan Laporan'
      });
    } catch (error) {
      console.error("Capacitor Share Error:", error);
      doc.save(fileName);
    }
  } else {
    doc.save(fileName);
  }
};

export const generateLaptopRequestPDF = async (request: LaptopRequest) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // --- DESIGN: Border & Background ---
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.1);
  doc.rect(5, 5, 200, 287); // Page border
  
  // --- HEADER ---
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('KEMENTERIAN SOSIAL REPUBLIK INDONESIA', 105, 18, { align: 'center' });
  doc.setFontSize(16);
  doc.text('SEKOLAH RAKYAT MENENGAH ATAS 24 KEDIRI', 105, 25, { align: 'center' });
  doc.setFontSize(12);
  doc.setTextColor(79, 70, 229); // Indigo color
  doc.text(`GURU MATA PELAJARAN: ${(request.mapel || '').toUpperCase()}`, 105, 32, { align: 'center' });
  
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
  doc.text('SURAT PERMOHONAN PINJAMAN LAPTOP', 105, 65, { align: 'center' });
  doc.setLineWidth(0.5);
  doc.line(60, 66.5, 150, 66.5);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Nomor : ${request.nomor_surat}`, 105, 72, { align: 'center' });

  // --- RECIPIENT ---
  doc.setFontSize(11);
  doc.text('Kepada Yth.', 20, 85);
  doc.setFont('helvetica', 'bold');
  doc.text(`Bapak/Ibu Wali Asuh`, 20, 91);
  doc.text(`SRMA 24 Kediri`, 20, 96);
  doc.setFont('helvetica', 'normal');
  doc.text('di Tempat', 20, 101);

  // --- CONTENT ---
  doc.text('Dengan hormat,', 20, 115);
  doc.text('Saya yang bertanda tangan di bawah ini:', 20, 122);

  doc.setFont('helvetica', 'bold');
  doc.text('Nama', 30, 130);
  doc.text('NIP/ID', 30, 137);
  doc.text('Mata Pelajaran', 30, 144);

  doc.setFont('helvetica', 'normal');
  doc.text(`:  ${request.guru_name}`, 70, 130);
  doc.text(`:  ${(request.guru_uid || '').substring(0, 8).toUpperCase()}`, 70, 137);
  doc.text(`:  ${request.mapel}`, 70, 144);

  doc.text(`Bermaksud mengajukan permohonan peminjaman fasilitas laptop untuk menunjang kegiatan belajar mengajar bagi siswa dangan daftar sebagai berikut:`, 20, 155, { maxWidth: 170 });

  // Student List
  let currentY = 168;
  doc.setFont('helvetica', 'bold');
  doc.text(`Kelas: ${request.kelas}`, 20, currentY);
  currentY += 8;
  
  doc.setFont('helvetica', 'normal');
  request.daftar_siswa.forEach((name, index) => {
    if (currentY > 240) {
      doc.addPage();
      currentY = 20;
    }
    doc.text(`${index + 1}. ${name}`, 25, currentY);
    currentY += 7;
  });

  const closingY = currentY + 10;
  doc.text('Demikian permohonan ini saya sampaikan, mohon untuk dapat diperhatikan dan diberikan izin peminjaman sebagaimana mestinya demi kelancaran proses akademik siswa.', 20, closingY, { maxWidth: 170, align: 'justify' });
  doc.text('Atas perhatian dan kerja samanya, saya ucapkan terima kasih.', 20, closingY + 15);

  // --- SIGNATURE ---
  const footerY = 240;
  const tglRequestStr = request.tgl_request && typeof request.tgl_request.toDate === 'function' ? format(request.tgl_request.toDate(), 'dd MMMM yyyy') : format(new Date(), 'dd MMMM yyyy');
  
  const qrGuru = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=LAPTOP_REQ_VERIFIED_GURU_${request.id}_${request.guru_name}`;
  doc.addImage(qrGuru, 'PNG', 145, footerY - 5, 25, 25);

  doc.setFont('helvetica', 'normal');
  doc.text(`Kediri, ${tglRequestStr}`, 155, footerY - 15, { align: 'center' });
  doc.text('Hormat Saya,', 155, footerY - 10, { align: 'center' });
  doc.text('Guru Mata Pelajaran,', 155, footerY - 5, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.text(request.guru_name, 155, footerY + 28, { align: 'center' });
  doc.line(130, footerY + 29, 180, footerY + 29);

  // Security Note
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text('Dokumen ini sah dan ditandatangani secara elektronik melalui Sistem SRMA 24.', 105, 275, { align: 'center' });
  doc.text('Verifikasi keaslian dapat dilakukan dengan memindai QR Code di atas.', 105, 279, { align: 'center' });

  // --- OUTPUT ---
  const fileName = `Request_Laptop_${request.kelas}_${Date.now()}.pdf`;
  
  if (Capacitor.isNativePlatform()) {
    try {
      const pdfBase64 = doc.output('datauristring').split(',')[1];
      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: pdfBase64,
        directory: Directory.Cache
      });
      await Share.share({
        title: 'Permohonan Pinjaman Laptop',
        text: `Permohonan Pinjaman Laptop - ${request.kelas}`,
        url: savedFile.uri,
        dialogTitle: 'Simpan atau Bagikan Permohonan'
      });
    } catch (error) {
      console.error("Capacitor Share Error:", error);
      doc.save(fileName);
    }
  } else {
    doc.save(fileName);
  }
};

export const generateHPRequestPDF = async (request: HPRequest) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // --- DESIGN: Border & Background ---
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.1);
  doc.rect(5, 5, 200, 287); // Page border
  
  // --- HEADER ---
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('KEMENTERIAN SOSIAL REPUBLIK INDONESIA', 105, 18, { align: 'center' });
  doc.setFontSize(16);
  doc.text('SEKOLAH RAKYAT MENENGAH ATAS 24 KEDIRI', 105, 25, { align: 'center' });
  doc.setFontSize(12);
  doc.setTextColor(79, 70, 229); // Indigo color
  doc.text(`GURU MATA PELAJARAN: ${(request.mapel || '').toUpperCase()}`, 105, 32, { align: 'center' });
  
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
  doc.text('SURAT PERMOHONAN PEMINJAMAN HANDPHONE (HP)', 105, 65, { align: 'center' });
  doc.setLineWidth(0.5);
  doc.line(60, 66.5, 150, 66.5);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Nomor : ${request.nomor_surat}`, 105, 72, { align: 'center' });

  // --- RECIPIENT ---
  doc.setFontSize(11);
  doc.text('Kepada Yth.', 20, 85);
  doc.setFont('helvetica', 'bold');
  doc.text(`Bapak/Ibu Wali Asuh`, 20, 91);
  doc.text(`SRMA 24 Kediri`, 20, 96);
  doc.setFont('helvetica', 'normal');
  doc.text('di Tempat', 20, 101);

  // --- CONTENT ---
  doc.text('Dengan hormat,', 20, 115);
  doc.text('Saya yang bertanda tangan di bawah ini:', 20, 122);

  doc.setFont('helvetica', 'bold');
  doc.text('Nama', 30, 130);
  doc.text('NIP/ID', 30, 137);
  doc.text('Mata Pelajaran', 30, 144);

  doc.setFont('helvetica', 'normal');
  doc.text(`:  ${request.guru_name}`, 70, 130);
  doc.text(`:  ${(request.guru_uid || '').substring(0, 8).toUpperCase()}`, 70, 137);
  doc.text(`:  ${request.mapel}`, 70, 144);

  doc.text(`Bermaksud mengajukan permohonan peminjaman fasilitas handphone (HP) untuk menunjang kegiatan pembelajaran/praktikum bagi siswa dangan daftar sebagai berikut:`, 20, 155, { maxWidth: 170 });

  // Student List
  let currentY = 168;
  doc.setFont('helvetica', 'bold');
  doc.text(`Kelas: ${request.kelas}`, 20, currentY);
  currentY += 8;
  
  doc.setFont('helvetica', 'normal');
  request.daftar_siswa.forEach((name, index) => {
    if (currentY > 240) {
      doc.addPage();
      currentY = 20;
    }
    doc.text(`${index + 1}. ${name}`, 25, currentY);
    currentY += 7;
  });

  const closingY = currentY + 10;
  doc.text('Demikian permohonan ini saya sampaikan, mohon untuk dapat diperhatikan dan diberikan izin peminjaman HP sesuai prosedur yang berlaku demi kelancaran tugas akademik siswa.', 20, closingY, { maxWidth: 170, align: 'justify' });
  doc.text('Atas perhatian dan kerja samanya, saya ucapkan terima kasih.', 20, closingY + 15);

  // --- SIGNATURE ---
  const footerY = 240;
  const tglRequestStr = request.tgl_request && typeof request.tgl_request.toDate === 'function' ? format(request.tgl_request.toDate(), 'dd MMMM yyyy') : format(new Date(), 'dd MMMM yyyy');
  
  const qrGuru = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=HP_REQ_VERIFIED_GURU_${request.id}_${request.guru_name}`;
  doc.addImage(qrGuru, 'PNG', 145, footerY - 5, 25, 25);

  doc.setFont('helvetica', 'normal');
  doc.text(`Kediri, ${tglRequestStr}`, 155, footerY - 15, { align: 'center' });
  doc.text('Hormat Saya,', 155, footerY - 10, { align: 'center' });
  doc.text('Guru Mata Pelajaran,', 155, footerY - 5, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.text(request.guru_name, 155, footerY + 28, { align: 'center' });
  doc.line(130, footerY + 29, 180, footerY + 29);

  // Security Note
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text('Dokumen ini sah dan ditandatangani secara elektronik melalui Sistem SRMA 24.', 105, 275, { align: 'center' });
  doc.text('Verifikasi keaslian dapat dilakukan dengan memindai QR Code di atas.', 105, 279, { align: 'center' });

  // --- OUTPUT ---
  const fileName = `Request_HP_${request.kelas}_${Date.now()}.pdf`;
  
  if (Capacitor.isNativePlatform()) {
    try {
      const pdfBase64 = doc.output('datauristring').split(',')[1];
      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: pdfBase64,
        directory: Directory.Cache
      });
      await Share.share({
        title: 'Permohonan Pinjaman HP',
        text: `Permohonan Pinjaman HP - ${request.kelas}`,
        url: savedFile.uri,
        dialogTitle: 'Simpan atau Bagikan Permohonan'
      });
    } catch (error) {
      console.error("Capacitor Share Error:", error);
      doc.save(fileName);
    }
  } else {
    doc.save(fileName);
  }
};

export const generateMemorandumPDF = async (memo: Memorandum) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // --- DESIGN: Border & Background ---
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.1);
  doc.rect(5, 5, 200, 287); // Page border
  
  // --- HEADER ---
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('KEMENTERIAN SOSIAL REPUBLIK INDONESIA', 105, 18, { align: 'center' });
  doc.setFontSize(16);
  doc.text('SEKOLAH RAKYAT MENENGAH ATAS 24 KEDIRI', 105, 25, { align: 'center' });
  doc.setFontSize(12);
  doc.setTextColor(79, 70, 229); // Indigo color
  doc.text('KANTOR KEPALA SEKOLAH', 105, 32, { align: 'center' });
  
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
  doc.text('MEMORANDUM INTERN', 105, 65, { align: 'center' });
  doc.setLineWidth(0.5);
  doc.line(70, 66.5, 140, 66.5);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Nomor : ${memo.nomor_memo}`, 105, 72, { align: 'center' });

  // --- INFO TABLE ---
  const infoY = 85;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Dari', 20, infoY);
  doc.text('Kepada', 20, infoY + 8);
  doc.text('Tanggal', 20, infoY + 16);
  doc.text('Perihal', 20, infoY + 24);

  doc.setFont('helvetica', 'normal');
  doc.text(`:  ${memo.pengirim_name}`, 50, infoY);
  
  const penerimaLabels = memo.penerima.map(p => {
    switch(p) {
      case 'dokter': return 'Dokter/Petugas UKS';
      case 'wali_asuh': return 'Wali Asuh';
      case 'wali_kelas': return 'Wali Kelas';
      default: return p;
    }
  }).join(', ');
  
  doc.text(`:  ${penerimaLabels}`, 50, infoY + 8);
  
  const tglMemoStr = memo.tgl_memo && typeof memo.tgl_memo.toDate === 'function' ? format(memo.tgl_memo.toDate(), 'dd MMMM yyyy') : '-';
  doc.text(`:  ${tglMemoStr}`, 50, infoY + 16);
  doc.setFont('helvetica', 'bold');
  doc.text(`:  ${(memo.perihal || '').toUpperCase()}`, 50, infoY + 24);

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.2);
  doc.line(20, infoY + 28, 190, infoY + 28);

  // --- CONTENT ---
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  const contentY = infoY + 38;
  const splitText = doc.splitTextToSize(memo.isi, 170);
  doc.text(splitText, 20, contentY, { align: 'justify', lineHeightFactor: 1.5 });

  // --- CLOSING ---
  const closingY = contentY + (splitText.length * 7) + 15;
  doc.text('Demikian memorandum ini disampaikan untuk dapat dilaksanakan dengan penuh tanggung jawab.', 20, closingY, { maxWidth: 170 });

  // --- SIGNATURE ---
  const footerY = closingY + 25;
  const qrKepala = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=MEMO_VERIFIED_KEPALA_SEKOLAH_${memo.id}_${memo.pengirim_name}`;
  doc.addImage(qrKepala, 'PNG', 140, footerY + 10, 25, 25);

  doc.setFont('helvetica', 'normal');
  doc.text('Kediri, ' + tglMemoStr, 150, footerY, { align: 'center' });
  doc.text('Kepala Sekolah,', 150, footerY + 5, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.text(memo.pengirim_name, 150, footerY + 45, { align: 'center' });
  doc.setLineWidth(0.2);
  doc.line(120, footerY + 46, 180, footerY + 46);

  // Security Note
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text('Dokumen ini adalah memorandum resmi SRMA 24 Kediri yang ditandatangani secara elektronik.', 105, 275, { align: 'center' });
  doc.text('Keaslian dokumen dapat divalidasi melalui sistem internal sekolah.', 105, 279, { align: 'center' });

  // --- OUTPUT ---
  const fileName = `Memo_${(memo.perihal || '').replace(/\s+/g, '_')}_${Date.now()}.pdf`;
  
  if (Capacitor.isNativePlatform()) {
    try {
      const pdfBase64 = doc.output('datauristring').split(',')[1];
      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: pdfBase64,
        directory: Directory.Cache
      });
      await Share.share({
        title: 'Memorandum Kepala Sekolah',
        text: `Memorandum - ${memo.perihal}`,
        url: savedFile.uri,
        dialogTitle: 'Simpan atau Bagikan Memorandum'
      });
    } catch (error) {
      console.error("Capacitor Share Error:", error);
      doc.save(fileName);
    }
  } else {
    doc.save(fileName);
  }
};

export const generateHealthCheckProposalPDF = async (proposal: HealthCheckProposal) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // --- DESIGN: Border & Header ---
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.1);
  doc.rect(5, 5, 200, 287); // Page border
  
  // --- HEADER ---
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('KEMENTERIAN SOSIAL REPUBLIK INDONESIA', 105, 18, { align: 'center' });
  doc.setFontSize(16);
  doc.text('SEKOLAH RAKYAT MENENGAH ATAS 24 KEDIRI', 105, 25, { align: 'center' });
  doc.setFontSize(12);
  doc.setTextColor(79, 70, 229); // Indigo color
  doc.text('UNIT ASRAMA SISWA', 105, 32, { align: 'center' });
  
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
  doc.text('SURAT USULAN PENGECEKAN KESEHATAN SISWA', 105, 65, { align: 'center' });
  doc.setLineWidth(0.5);
  doc.line(40, 66.5, 170, 66.5);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const tglUsulanStr = proposal.tgl_usulan && typeof proposal.tgl_usulan.toDate === 'function' 
    ? format(proposal.tgl_usulan.toDate(), 'dd/MM/yyyy HH:mm') 
    : format(new Date(), 'dd/MM/yyyy HH:mm');
  doc.text(`Tanggal Usulan : ${tglUsulanStr}`, 105, 72, { align: 'center' });

  // --- CONTENT ---
  doc.setFontSize(11);
  doc.text('Kepada Yth.', 20, 85);
  doc.setFont('helvetica', 'bold');
  doc.text(`Dokter / Petugas Kesehatan Sekolah (UKS)`, 20, 91);
  doc.text(`SRMA 24 Kediri`, 20, 96);
  doc.setFont('helvetica', 'normal');
  doc.text('di Tempat', 20, 101);

  doc.text('Dengan hormat,', 20, 115);
  doc.text(`Saya yang bertanda tangan di bawah ini, selaku Wali Asrama ${proposal.asrama || ''} mengusulkan pengecekan kesehatan bagi siswa di bawah ini dikarenakan adanya indikasi gangguan kesehatan:`, 20, 122, { maxWidth: 170 });

  // Student List
  let currentY = 138;
  doc.setFont('helvetica', 'bold');
  doc.text(`DAFTAR SISWA USULAN:`, 20, currentY);
  currentY += 8;
  
  doc.setFont('helvetica', 'normal');
  proposal.daftar_siswa.forEach((name, index) => {
    if (currentY > 240) {
      doc.addPage();
      currentY = 20;
    }
    doc.text(`${index + 1}. ${name}`, 25, currentY);
    currentY += 7;
  });

  if (proposal.keterangan) {
    currentY += 5;
    doc.setFont('helvetica', 'bold');
    doc.text('Catatan / Keluhan:', 20, currentY);
    currentY += 6;
    doc.setFont('helvetica', 'normal');
    const splitKeterangan = doc.splitTextToSize(proposal.keterangan, 170);
    doc.text(splitKeterangan, 20, currentY);
    currentY += (splitKeterangan.length * 7);
  }

  const closingY = currentY + 10;
  doc.text('Demikian usulan ini saya sampaikan untuk dapat segera ditindaklanjuti. Atas perhatian dan kerja samanya, saya ucapkan terima kasih.', 20, closingY, { maxWidth: 170, align: 'justify' });

  // --- SIGNATURE ---
  const footerY = 240;
  const tglStr = proposal.tgl_usulan && typeof proposal.tgl_usulan.toDate === 'function' ? format(proposal.tgl_usulan.toDate(), 'dd MMMM yyyy') : format(new Date(), 'dd MMMM yyyy');
  
  doc.setFont('helvetica', 'normal');
  doc.text(`Kediri, ${tglStr}`, 155, footerY - 15, { align: 'center' });
  doc.text('Hormat Saya,', 155, footerY - 10, { align: 'center' });
  doc.text('Wali Asrama,', 155, footerY - 5, { align: 'center' });
  
  const qrWali = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=HEALTH_CHECK_USULAN_${proposal.id}_${proposal.proposer_name}`;
  doc.addImage(qrWali, 'PNG', 145, footerY - 2, 25, 25);

  doc.setFont('helvetica', 'bold');
  doc.text(proposal.proposer_name, 155, footerY + 30, { align: 'center' });
  doc.line(130, footerY + 31, 180, footerY + 31);

  // Security Note
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text('Dokumen ini adalah usulan resmi internal asrama SRMA 24 Kediri.', 105, 275, { align: 'center' });
  doc.text('Generated via Digital Health System SRMA 24.', 105, 279, { align: 'center' });

  // --- OUTPUT ---
  const fileName = `Usulan_Cek_${proposal.proposer_name.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
  
  if (Capacitor.isNativePlatform()) {
    try {
      const pdfBase64 = doc.output('datauristring').split(',')[1];
      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: pdfBase64,
        directory: Directory.Cache
      });
      await Share.share({
        title: 'Usulan Cek Kesehatan',
        text: `Usulan Cek Kesehatan dari Wali Asrama ${proposal.proposer_name}`,
        url: savedFile.uri,
        dialogTitle: 'Simpan atau Bagikan Usulan'
      });
    } catch (error) {
      console.error("Capacitor Share Error:", error);
      doc.save(fileName);
    }
  } else {
    doc.save(fileName);
  }
};

export const generateSarprasReportPDF = async (report: SarprasReport) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // --- DESIGN: Border & Background ---
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.1);
  doc.rect(5, 5, 200, 287); // Page border
  
  // --- HEADER ---
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('KEMENTERIAN SOSIAL REPUBLIK INDONESIA', 105, 18, { align: 'center' });
  doc.setFontSize(16);
  doc.text('SEKOLAH RAKYAT MENENGAH ATAS 24 KEDIRI', 105, 25, { align: 'center' });
  doc.setFontSize(12);
  doc.setTextColor(185, 28, 28); // Red color for damage/sarpras
  doc.text('UNIT LINGKUNGAN DAN ASRAMA (WALI ASRAMA)', 105, 32, { align: 'center' });
  
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
  doc.text('LAPORAN KERUSAKAN SARANA DAN PRASARANA', 105, 65, { align: 'center' });
  doc.setLineWidth(0.5);
  doc.line(40, 66.5, 170, 66.5);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const tglLaporStr = report.tgl_lapor && typeof report.tgl_lapor.toDate === 'function' ? format(report.tgl_lapor.toDate(), 'dd/MM/yyyy/HH:mm') : format(new Date(), 'dd/MM/yyyy');
  doc.text(`Nomor Laporan: SARPRAS/${tglLaporStr}/${(report.author_name || '').substring(0,3).toUpperCase()}`, 105, 72, { align: 'center' });

  // --- RECIPIENT ---
  doc.setFontSize(11);
  doc.text('Kepada Yth.', 20, 85);
  doc.setFont('helvetica', 'bold');
  doc.text(`Bagian Sarpras SRMA 24 Kediri`, 20, 91);
  doc.setFont('helvetica', 'normal');
  doc.text('di Tempat', 20, 96);

  // --- CONTENT ---
  doc.text('Dengan hormat,', 20, 110);
  doc.text('Bersama surat ini, saya yang bertanda tangan di bawah ini melaporkan adanya kerusakan pada sarana/prasarana di lingkungan asrama dengan rincian sebagai berikut:', 20, 117, { maxWidth: 170 });

  const startY = 135;
  const labelX = 25;
  const valueX = 75;

  const details = [
    { label: 'Nama Barang/Sarana', value: report.item_name },
    { label: 'Lokasi Kerusakan', value: report.location },
    { label: 'Asrama', value: report.asrama },
    { label: 'Deskripsi Kerusakan', value: report.damage_description },
    { label: 'Status Laporan', value: report.status.toUpperCase() }
  ];

  let currentY = startY;
  details.forEach((item) => {
    doc.setFont('helvetica', 'bold');
    doc.text(item.label, labelX, currentY);
    
    doc.setFont('helvetica', 'normal');
    const valueText = `:  ${item.value}`;
    const splitValue = doc.splitTextToSize(valueText, 110);
    doc.text(splitValue, valueX, currentY);
    
    currentY += (splitValue.length * 6) + 4;
  });

  doc.text('Demikian laporan ini saya sampaikan untuk dapat segera ditindaklanjuti demi kenyamanan dan kelancaran kegiatan di asrama. Atas perhatiannya diucapkan terima kasih.', 20, currentY + 10, { maxWidth: 170 });

  // --- SIGNATURE ---
  const footerY = 240;
  const tglStr = report.tgl_lapor && typeof report.tgl_lapor.toDate === 'function' ? format(report.tgl_lapor.toDate(), 'dd MMMM yyyy') : format(new Date(), 'dd MMMM yyyy');
  
  doc.setFont('helvetica', 'normal');
  doc.text(`Kediri, ${tglStr}`, 155, footerY - 15, { align: 'center' });
  doc.text('Pelapor,', 155, footerY - 10, { align: 'center' });
  
  const qrData = `SARPRAS_REPORT_VERIFIED_${report.id}_${report.author_name}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrData)}`;
  doc.addImage(qrUrl, 'PNG', 142.5, footerY - 2, 25, 25);

  doc.setFont('helvetica', 'bold');
  doc.text(report.author_name, 155, footerY + 28, { align: 'center' });
  doc.line(130, footerY + 29, 180, footerY + 29);
  doc.setFont('helvetica', 'normal');
  doc.text('Wali Asrama', 155, footerY + 34, { align: 'center' });

  // --- OUTPUT ---
  const fileName = `Laporan_Sarpras_${(report.item_name || '').replace(/\s+/g, '_')}_${Date.now()}.pdf`;
  
  if (Capacitor.isNativePlatform()) {
    try {
      const pdfBase64 = doc.output('datauristring').split(',')[1];
      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: pdfBase64,
        directory: Directory.Cache
      });
      await Share.share({
        title: 'Laporan Kerusakan Sarpras',
        text: `Laporan Sarpras - ${report.item_name}`,
        url: savedFile.uri,
        dialogTitle: 'Simpan atau Bagikan Laporan'
      });
    } catch (error) {
      console.error("Capacitor Share Error:", error);
      doc.save(fileName);
    }
  } else {
    doc.save(fileName);
  }
};

export const generateSarprasSummaryPDF = async (reports: SarprasReport[], filter: string, currentUser: { name: string, role: string }) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // --- HEADER ---
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('KEMENTERIAN SOSIAL REPUBLIK INDONESIA', 105, 18, { align: 'center' });
  doc.setFontSize(16);
  doc.text('SEKOLAH RAKYAT MENENGAH ATAS 24 KEDIRI', 105, 25, { align: 'center' });
  doc.setFontSize(12);
  doc.setTextColor(185, 28, 28);
  doc.text('REKAPITULASI KERUSAKAN SARANA DAN PRASARANA', 105, 32, { align: 'center' });
  
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.8);
  doc.line(20, 52, 190, 52);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text(`Periode Rekap: ${filter.replace('_', ' ').toUpperCase()}`, 20, 60);
  doc.text(`Tanggal Cetak: ${format(new Date(), 'dd MMMM yyyy')}`, 20, 65);

  // --- TABLE HEADER ---
  const startY = 75;
  doc.setFont('helvetica', 'bold');
  doc.setFillColor(245, 245, 245);
  doc.rect(20, startY, 170, 10, 'F');
  doc.rect(20, startY, 170, 10);
  
  doc.text('No', 22, startY + 7);
  doc.text('Tgl Lapor', 32, startY + 7);
  doc.text('Item / Lokasi', 55, startY + 7);
  doc.text('Deskripsi Kerusakan', 115, startY + 7);

  // --- TABLE ROWS ---
  let currentY = startY + 10;
  doc.setFont('helvetica', 'normal');
  
  reports.forEach((report, index) => {
    const tglStr = report.tgl_lapor && typeof report.tgl_lapor.toDate === 'function' 
      ? format(report.tgl_lapor.toDate(), 'dd/MM/yy') 
      : '-';

    const itemLoc = `${report.item_name} (${report.location})`;
    const splitItem = doc.splitTextToSize(itemLoc, 55);
    const splitDesc = doc.splitTextToSize(report.damage_description || '-', 70);
    
    const rowHeight = Math.max(splitItem.length * 5, splitDesc.length * 5, 10);

    if (currentY + rowHeight > 270) {
      doc.addPage();
      currentY = 20;
      // Redraw header on new page
      doc.setFont('helvetica', 'bold');
      doc.setFillColor(245, 245, 245);
      doc.rect(20, currentY, 170, 10, 'F');
      doc.rect(20, currentY, 170, 10);
      doc.text('No', 22, currentY + 7);
      doc.text('Tgl Lapor', 32, currentY + 7);
      doc.text('Item / Lokasi', 55, currentY + 7);
      doc.text('Deskripsi Kerusakan', 115, currentY + 7);
      doc.setFont('helvetica', 'normal');
      currentY += 10;
    }
    
    doc.text(`${index + 1}`, 22, currentY + 7);
    doc.text(tglStr, 32, currentY + 7);
    doc.text(splitItem, 55, currentY + 7);
    doc.text(splitDesc, 115, currentY + 7);
    
    doc.rect(20, currentY, 170, rowHeight);
    currentY += rowHeight;
  });

  // --- SIGNATURE ---
  const footerY = 250;
  if (currentY > 230) {
    doc.addPage();
    currentY = 20;
  }
  
  const roleLabel = currentUser.role === 'kepala_sekolah' ? 'Kepala Sekolah' : 
                   currentUser.role === 'wali_asuh' ? 'Wali Asuh' : 
                   currentUser.role === 'wali_asrama' ? 'Wali Asrama' : 'Petugas';

  doc.setFont('helvetica', 'normal');
  doc.text(`Kediri, ${format(new Date(), 'dd MMMM yyyy')}`, 155, footerY - 15, { align: 'center' });
  doc.text('Mengetahui,', 155, footerY - 10, { align: 'center' });
  doc.text(roleLabel, 155, footerY - 5, { align: 'center' });
  
  doc.setFont('helvetica', 'bold');
  doc.text(currentUser.name, 155, footerY + 20, { align: 'center' });
  doc.line(130, footerY + 21, 180, footerY + 21);

  // --- OUTPUT ---
  const fileName = `Rekap_Sarpras_${filter}_${Date.now()}.pdf`;
  if (Capacitor.isNativePlatform()) {
    try {
      const pdfBase64 = doc.output('datauristring').split(',')[1];
      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: pdfBase64,
        directory: Directory.Cache
      });
      await Share.share({
        title: 'Rekap Laporan Sarpras',
        url: savedFile.uri
      });
    } catch (error) {
      doc.save(fileName);
    }
  } else {
    doc.save(fileName);
  }
};

export const generateMonthlyReportPDF = async (report: MonthlyReport) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // --- Background and Border ---
  doc.setDrawColor(240, 240, 240);
  doc.setLineWidth(0.1);
  doc.rect(5, 5, 200, 287);
  
  // --- Header ---
  doc.setTextColor(120, 120, 120);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('SEKOLAH RAKYAT · SRMA 24 KEDIRI', 105, 12, { align: 'center' });
  
  doc.setTextColor(40, 40, 40);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Laporan Tumbuh Kembang Bulanan', 105, 19, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(`Periode: ${report.periode_bulan}`, 105, 25, { align: 'center' });
  
  doc.setDrawColor(20, 148, 140); // Teal color from image
  doc.setLineWidth(0.8);
  doc.line(20, 29, 190, 29);

  // --- Profile Section (Card) ---
  doc.setFillColor(252, 255, 254);
  doc.roundedRect(20, 35, 170, 38, 3, 3, 'F');
  doc.setDrawColor(230, 240, 238);
  doc.setLineWidth(0.2);
  doc.roundedRect(20, 35, 170, 38, 3, 3, 'S');

  // Avatar Placeholder (Circle)
  doc.setDrawColor(20, 148, 140);
  doc.setLineWidth(0.5);
  doc.circle(42, 54, 12, 'S');

  if (report.foto_siswa_url) {
    try {
      const imgData = await getImageDataUrl(report.foto_siswa_url);
      doc.saveGraphicsState();
      doc.circle(42, 54, 12, 'f'); // This is a bit tricky with clipping
      // Actually jspdf clipping is complex, let's just use regular addImage
      // and maybe draw a circle over it if we want it perfect, but let's try clipping
      doc.clip();
      doc.addImage(imgData, 'JPEG', 30, 42, 24, 24);
      doc.restoreGraphicsState();
      // redraw circle border
      doc.setDrawColor(20, 148, 140);
      doc.circle(42, 54, 12, 'S');
    } catch (e) {
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.text('PHOTO', 42, 55, { align: 'center' });
    }
  } else {
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text('PHOTO', 42, 55, { align: 'center' });
  }

  // Student Info
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(report.nama_siswa, 65, 43);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  
  const labels = ['Kelas / Jenjang', 'Kamar / Asrama', 'Wali Asuh', 'Periode Laporan'];
  const values = [report.kelas, report.asrama, report.wali_asuh_name, report.periode_bulan];
  
  labels.forEach((label, i) => {
    doc.text(label, 65, 50 + (i * 5));
    doc.text(`:  ${values[i]}`, 100, 50 + (i * 5));
  });

  // --- KESEHATAN Section ---
  let currentY = 82;
  doc.setTextColor(160, 160, 160);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('KESEHATAN & FISIK', 20, currentY);
  
  currentY += 7;
  doc.setTextColor(40, 40, 40);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Berat Badan:`, 20, currentY);
  doc.setFont('helvetica', 'bold');
  doc.text(`${report.berat_badan} kg`, 40, currentY);
  
  doc.setFont('helvetica', 'normal');
  doc.text(`Tinggi Badan:`, 65, currentY);
  doc.setFont('helvetica', 'bold');
  doc.text(`${report.tinggi_badan} cm`, 85, currentY);
  
  doc.setFont('helvetica', 'normal');
  doc.text('Status:', 115, currentY);
  doc.setFillColor(34, 197, 94); // Green
  doc.circle(128, currentY - 1, 1.5, 'F');
  doc.text(report.status_kesehatan, 132, currentY);

  currentY += 8;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Catatan:', 25, currentY);
  doc.setFont('helvetica', 'normal');
  const catTexts = doc.splitTextToSize(report.catatan_kesehatan || '-', 150);
  doc.text(catTexts, 40, currentY);
  currentY += (catTexts.length * 5) + 6;

  // --- KARAKTER Section ---
  doc.setTextColor(160, 160, 160);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('EVALUASI KARAKTER', 20, currentY);
  
  currentY += 7;
  doc.setTextColor(40, 40, 40);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Kedisplinan Ibadah:', 20, currentY);
  // draw stars
  for(let i = 0; i < 5; i++) {
    if (i < report.ibadah_score) {
      doc.setTextColor(255, 193, 7); // Gold
    } else {
      doc.setTextColor(220, 220, 220); // light gray
    }
    doc.text('★', 55 + (i * 4), currentY);
  }
  doc.setTextColor(150, 150, 150);
  doc.text(`(${report.ibadah_score}/5)`, 77, currentY);

  doc.setTextColor(40, 40, 40);
  doc.text('Kesantunan & Adab:', 110, currentY);
  for(let i = 0; i < 5; i++) {
    if (i < report.adab_score) {
      doc.setTextColor(255, 193, 7);
    } else {
      doc.setTextColor(220, 220, 220);
    }
    doc.text('★', 145 + (i * 4), currentY);
  }
  doc.setTextColor(150, 150, 150);
  doc.text(`(${report.adab_score}/5)`, 167, currentY);

  currentY += 7;
  doc.setTextColor(40, 40, 40);
  doc.text(`Kemandirian:`, 20, currentY);
  doc.setFont('helvetica', 'bold');
  doc.text(`${report.kemandirian_score}/100`, 42, currentY);
  doc.setTextColor(20, 148, 140);
  doc.text(`(${report.kemandirian_level})`, 57, currentY);

  currentY += 8;
  doc.setTextColor(40, 40, 40);
  doc.setFont('helvetica', 'bold');
  doc.text('Deskripsi:', 25, currentY);
  doc.setFont('helvetica', 'normal');
  const karTexts = doc.splitTextToSize(report.karakter_deskripsi || '-', 150);
  doc.text(karTexts, 42, currentY);
  currentY += (karTexts.length * 5) + 6;

  // --- AKADEMIK Section ---
  doc.setTextColor(160, 160, 160);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('AKADEMIK & MINAT BAKAT', 20, currentY);
  
  currentY += 8;
  doc.setTextColor(40, 40, 40);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const acadTexts = doc.splitTextToSize(report.akademik_deskripsi || '-', 170);
  doc.text(acadTexts, 20, currentY);
  currentY += (acadTexts.length * 5) + 5;

  doc.text(`Ekstrakurikuler:`, 20, currentY);
  doc.setFont('helvetica', 'bold');
  doc.text(report.ekstrakurikuler ? report.ekstrakurikuler.join(', ') : '-', 45, currentY);
  
  currentY += 7;
  doc.setFont('helvetica', 'normal');
  doc.text('Capaian Khusus:', 20, currentY);
  doc.setFont('helvetica', 'bold');
  doc.text(report.capaian_khusus || '-', 47, currentY, { maxWidth: 145, align: 'justify' });
  const capHeight = doc.getTextDimensions(report.capaian_khusus || '-', { maxWidth: 145 }).h;
  currentY += Math.max(capHeight, 5) + 8;

  // --- DOKUMENTASI Section ---
  doc.setTextColor(160, 160, 160);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('DOKUMENTASI KEGIATAN', 20, currentY);
  
  currentY += 5;
  const docPhotos = report.foto_kegiatan || [];
  for(let i = 0; i < 3; i++) {
    const x = 20 + (i * 58);
    doc.setFillColor(248, 248, 248);
    doc.setDrawColor(240, 240, 240);
    doc.rect(x, currentY, 54, 34, 'FD');
    
    if (docPhotos[i]) {
      try {
        const imgData = await getImageDataUrl(docPhotos[i]);
        doc.addImage(imgData, 'JPEG', x, currentY, 54, 34);
      } catch (e) {
        doc.setFontSize(7);
        doc.setTextColor(200, 200, 200);
        doc.text('IMAGE ERROR', x + 27, currentY + 18, { align: 'center' });
      }
    } else {
      doc.setFontSize(7);
      doc.setTextColor(200, 200, 200);
      doc.text('TANPA FOTO', x + 27, currentY + 18, { align: 'center' });
    }
  }
  currentY += 42;

  // --- PESAN WALI ASUH Section ---
  doc.setTextColor(160, 160, 160);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('PESAN WALI ASUH', 20, currentY);
  
  currentY += 6;
  doc.setDrawColor(230, 230, 230);
  doc.line(20, currentY, 20, currentY + 15);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(60, 60, 60);
  doc.setFontSize(10);
  const pesanText = `"${report.pesan_wali_asuh || '-'}"`;
  doc.text(pesanText, 25, currentY + 4, { maxWidth: 165, align: 'justify' });
  const msgHeight = doc.getTextDimensions(pesanText, { maxWidth: 165 }).h;
  currentY += Math.max(msgHeight, 6) + 12;

  // --- FOOTER (QR & Signature) ---
  const footerY = 245;
  doc.setDrawColor(240, 240, 240);
  doc.line(20, footerY - 5, 190, footerY - 5);

  if (report.video_url) {
    try {
      const qrDataUrl = await QRCode.toDataURL(report.video_url);
      doc.addImage(qrDataUrl, 'PNG', 20, footerY, 32, 32);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(120, 120, 120);
      doc.text('Scan untuk melihat', 20, footerY + 36);
      doc.text('video pesan ananda', 20, footerY + 40);
    } catch (e) {
      console.error("QR Gen Error:", e);
    }
  }

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(40, 40, 40);
  doc.text(`Kediri, ${report.periode_bulan}`, 160, footerY + 2, { align: 'center' });
  doc.text('Wali Asuh,', 160, footerY + 7, { align: 'center' });
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(report.wali_asuh_name, 160, footerY + 35, { align: 'center' });
  doc.setLineWidth(0.4);
  doc.line(135, footerY + 36, 185, footerY + 36);

  const fileName = `Laporan_Bulanan_${report.nama_siswa.replace(/\s+/g, '_')}_${report.periode_bulan.replace(/\s+/g, '_')}.pdf`;
  
  if (Capacitor.isNativePlatform()) {
    try {
      const pdfBase64 = doc.output('datauristring').split(',')[1];
      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: pdfBase64,
        directory: Directory.Cache
      });
      await Share.share({
        title: 'Laporan Bulanan Siswa',
        text: `Laporan Tumbuh Kembang - ${report.nama_siswa}`,
        url: savedFile.uri
      });
    } catch (error) {
      doc.save(fileName);
    }
  } else {
    doc.save(fileName);
  }
};

export const generateProgressRecordPDF = async (record: ProgressRecord) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const dateOrigin = record.tgl_catatan?.toDate ? record.tgl_catatan.toDate() : new Date();
  const dateFormatted = format(dateOrigin, 'dd MMMM yyyy');
  
  // Official Kop Surat
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('KEMENTERIAN SOSIAL REPUBLIK INDONESIA', 105, 15, { align: 'center' });
  
  doc.setFontSize(14);
  doc.text('SEKOLAH RAKYAT MENENGAH ATAS 24 KEDIRI', 105, 21, { align: 'center' });
  
  // Joint Role line
  doc.setTextColor(67, 56, 202); 
  doc.setFontSize(12);
  doc.text('WALI KELAS / GURU MAPEL', 105, 27, { align: 'center' });
  
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Gedung Balai Pengembangan Kompetensi Aparatur Sipil Negara', 105, 33, { align: 'center' });
  doc.text('Gg. 2 Bulusari Utara, Bulusari, Kec. Tarokan, Kab. Kediri, Jawa Timur', 105, 37, { align: 'center' });
  doc.text('Email: srma24kediri@gmail.com | Kode Pos: 64152', 105, 41, { align: 'center' });

  // Double lines below header
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.8);
  doc.line(20, 44, 190, 44);
  doc.setLineWidth(0.2);
  doc.line(20, 45.5, 190, 45.5);

  // Document Title
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('SURAT CATATAN PERKEMBANGAN SISWA', 105, 58, { align: 'center' });
  doc.setLineWidth(0.5);
  doc.line(55, 59.5, 155, 59.5);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Nomor : SRMA-C-${record.id?.slice(-6).toUpperCase()}`, 105, 65, { align: 'center' });

  // Recipient Section
  doc.setFontSize(11);
  doc.text('Kepada Yth.', 20, 80);
  doc.setFont('helvetica', 'bold');
  doc.text(`Bapak/Ibu Wali Asuh ananda ${record.nama_siswa}`, 20, 85);
  doc.text('SRMA 24 Kediri', 20, 90);
  doc.setFont('helvetica', 'normal');
  doc.text('di Tempat', 20, 95);

  doc.text('Dengan hormat,', 20, 110);
  const openingText = 'Menerangkan bahwa berdasarkan hasil pengamatan dan evaluasi belajar di SRMA 24 Kediri, terdapat catatan penting bagi siswa tersebut di bawah ini:';
  doc.text(openingText, 20, 116, { maxWidth: 170, align: 'left' });

  // Student Data Table using autoTable to ensure perfect alignment, autowrapping, and justification
  autoTable(doc, {
    startY: 125,
    margin: { left: 20, right: 20 },
    theme: 'plain',
    styles: {
      fontSize: 10,
      font: 'helvetica',
      cellPadding: 3,
      valign: 'top',
      textColor: [0, 0, 0],
    },
    columnStyles: {
      0: { cellWidth: 40, fontStyle: 'bold' },
      1: { cellWidth: 5, fontStyle: 'bold' },
      2: { cellWidth: 'auto', halign: 'justify', fontStyle: 'normal' }
    },
    body: [
      ['Nama Lengkap', ':', record.nama_siswa.toUpperCase()],
      ['Kelas / Jurusan', ':', record.kelas],
      ['Isi Catatan', ':', record.isi_catatan]
    ],
    didDrawCell: (data) => {
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.1);
      doc.line(data.cell.x, data.cell.y + data.cell.height, data.cell.x + data.cell.width, data.cell.y + data.cell.height);
    }
  });

  const tableBottom = (doc as any).lastAutoTable.finalY + 10;

  // Closing Text inside another autoTable to guarantee clean justification & safe auto-pagination
  const closingText1 = 'Catatan ini diberikan sebagai bentuk perhatian dan koordinasi antara Wali Kelas dan Wali Asuh demi kebaikan proses belajar siswa yang bersangkutan. Mohon untuk dapat diperhatikan dan ditindaklanjuti sebagaimana mestinya.';
  const closingText2 = 'Demikian surat keterangan ini diberikan agar dapat dipergunakan sebagaimana mestinya. Atas perhatian Bapak/Ibu, kami sampaikan terima kasih.';

  autoTable(doc, {
    startY: tableBottom,
    margin: { left: 20, right: 20 },
    theme: 'plain',
    styles: {
      fontSize: 10,
      font: 'helvetica',
      cellPadding: 2,
      textColor: [0, 0, 0],
      halign: 'justify'
    },
    body: [
      [closingText1],
      [''],
      [closingText2]
    ]
  });

  const afterClosingY = (doc as any).lastAutoTable.finalY + 15;
  const signaturePageHeight = doc.internal.pageSize.getHeight();
  
  let sigY = afterClosingY;
  if (sigY + 55 > signaturePageHeight) {
    doc.addPage();
    sigY = 30;
  }
  doc.text(`Kediri, ${dateFormatted}`, 135, sigY);
  const authorRoleLabel = record.author_role === 'wali_kelas' ? 'Wali Kelas,' : 'Guru Mapel,';
  doc.text(authorRoleLabel, 135, sigY + 6);
  
  try {
    const qrData = `SRMA 24 DIGITAL HUB\nRecord ID: ${record.id}\nStudent: ${record.nama_siswa}\nAuthor: ${record.author_name}\nDate: ${dateFormatted}`;
    const qrDataUrl = await QRCode.toDataURL(qrData);
    doc.addImage(qrDataUrl, 'PNG', 145, sigY + 10, 25, 25);
  } catch (err) {
    console.error('Failed to generate QR code', err);
  }

  doc.setFont('helvetica', 'bold');
  doc.text(`${record.author_name}`, 135, sigY + 45);
  doc.setLineWidth(0.3);
  doc.line(135, sigY + 46.5, 185, sigY + 46.5); 
  
  doc.setTextColor(180, 180, 180);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  const disclaimerLabel = 'Dokumen ini sah dan ditandatangani secara elektronik melalui Sistem Digital Hub SRMA 24.';
  doc.text(disclaimerLabel, 105, 280, { align: 'center' });
  doc.text('Verifikasi keaslian dapat dilakukan dengan memindai QR Code di atas.', 105, 284, { align: 'center' });

  const fileName = `Catatan_Siswa_${record.nama_siswa.replace(/ /g, '_')}_${Date.now()}.pdf`;

  if (Capacitor.isNativePlatform()) {
    try {
      const pdfBase64 = doc.output('datauristring').split(',')[1];
      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: pdfBase64,
        directory: Directory.Cache
      });
      await Share.share({
        title: 'Catatan Perkembangan Siswa',
        text: `Catatan Siswa - ${record.nama_siswa}`,
        url: savedFile.uri,
        dialogTitle: 'Simpan atau Bagikan Catatan'
      });
    } catch (error) {
      console.error("Capacitor Share Error:", error);
      doc.save(fileName);
    }
  } else {
    doc.save(fileName);
  }
};

export const generateEvaluationNotesReportPDF = async (notes: EvaluationNote[], period: 'week' | 'month', userName: string) => {
  const doc = new jsPDF();
  const now = new Date();
  const { startOfWeek, startOfMonth, endOfDay } = await import('date-fns');
  const start = period === 'week' ? startOfWeek(now) : startOfMonth(now);
  const end = endOfDay(now);

  const dataToPrint = notes.filter(note => {
    const d = note.date?.toDate ? note.date.toDate() : new Date();
    return d >= start && d <= end;
  }).sort((a, b) => {
    const da = a.date?.toDate ? a.date.toDate().getTime() : 0;
    const db = b.date?.toDate ? b.date.toDate().getTime() : 0;
    return da - db;
  });

  if (dataToPrint.length === 0) {
    alert('Tidak ada data untuk periode ini.');
    return;
  }

  // Header / KOP
  doc.setFontSize(14);
  doc.setTextColor(44, 62, 80);
  doc.text('ASRAMA SRMA 24 KEDIRI', 105, 15, { align: 'center' });
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('LAPORAN EVALUASI WALI ASRAMA', 105, 25, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Periode: ${format(start, 'dd MMMM yyyy', { locale: id })} - ${format(end, 'dd MMMM yyyy', { locale: id })}`, 105, 33, { align: 'center' });
  doc.setLineWidth(0.5);
  doc.line(20, 36, 190, 36);

  // Table
  const tableData = dataToPrint.map(note => [
    format(note.date.toDate(), 'dd/MM/yy', { locale: id }),
    format(note.date.toDate(), 'HH:mm'),
    note.asrama,
    note.description,
    'Semua Anak'
  ]);

  autoTable(doc, {
    startY: 42,
    head: [['Tanggal', 'Jam', 'Asrama/Regu', 'Catatan Evaluasi', 'Keterangan']],
    body: tableData,
    theme: 'grid',
    styles: {
      overflow: 'linebreak',
      cellPadding: 2,
      fontSize: 8,
      valign: 'top',
      font: 'helvetica'
    },
    headStyles: { fillColor: [44, 62, 80], textColor: [255, 255, 255], fontSize: 9, fontStyle: 'bold' },
    bodyStyles: { textColor: [50, 50, 50] },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 15 },
      2: { cellWidth: 30 },
      3: { cellWidth: 'auto', halign: 'justify' },
      4: { cellWidth: 25 }
    },
    margin: { left: 20, right: 20 }
  });

  const finalY = (doc as any).lastAutoTable.finalY + 15;
  doc.setFontSize(10);
  doc.setTextColor(50, 50, 50);
  doc.text(`Dicetak pada: ${format(new Date(), 'dd MMMM yyyy HH:mm', { locale: id })}`, 20, Math.min(finalY, 280));
  
  const signatureX = 150;
  const sigY = Math.min(finalY, 240);
  doc.text('Mengetahui,', signatureX, sigY, { align: 'center' });
  doc.text('Wali Asrama', signatureX, sigY + 5, { align: 'center' });
  
  try {
    const qrDataUrl = await QRCode.toDataURL(userName);
    doc.addImage(qrDataUrl, 'PNG', signatureX - 12.5, sigY + 8, 25, 25);
  } catch (e) {
    console.error("QR Error", e);
  }
  
  doc.setFontSize(10);
  doc.text(userName, signatureX, sigY + 40, { align: 'center' });
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text('Digital Signature (Verified)', signatureX, sigY + 44, { align: 'center' });

  const fileName = `Laporan_Evaluasi_${period}_${Date.now()}.pdf`;

  if (Capacitor.isNativePlatform()) {
    try {
      const pdfBase64 = doc.output('datauristring').split(',')[1];
      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: pdfBase64,
        directory: Directory.Cache
      });
      await Share.share({
        title: 'Laporan Evaluasi Asrama',
        url: savedFile.uri
      });
    } catch (error) {
      doc.save(fileName);
    }
  } else {
    doc.save(fileName);
  }
};

export const generateDormitoryIncidentsReportPDF = async (incidents: DormitoryIncident[], period: 'week' | 'month', userName: string) => {
  const doc = new jsPDF('l', 'mm', 'a4');
  const now = new Date();
  const { startOfWeek, startOfMonth, endOfDay } = await import('date-fns');
  const start = period === 'week' ? startOfWeek(now) : startOfMonth(now);
  const end = endOfDay(now);

  const dataToPrint = incidents.filter(item => {
    const d = item.date?.toDate ? item.date.toDate() : new Date();
    return d >= start && d <= end;
  }).sort((a, b) => {
    const da = a.date?.toDate ? a.date.toDate().getTime() : 0;
    const db = b.date?.toDate ? b.date.toDate().getTime() : 0;
    return da - db;
  });

  if (dataToPrint.length === 0) {
    alert('Tidak ada data untuk periode ini.');
    return;
  }

  const pageWidth = doc.internal.pageSize.getWidth();
  const centerX = pageWidth / 2;

  // Header Brown Theme KOP
  doc.setFontSize(14);
  doc.setTextColor(62, 39, 35);
  doc.text('ASRAMA SRMA 24 KEDIRI', centerX, 15, { align: 'center' });
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('LAPORAN KEJADIAN ASRAMA', centerX, 25, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(141, 110, 99);
  doc.text(`Periode: ${format(start, 'dd MMMM yyyy', { locale: id })} - ${format(end, 'dd MMMM yyyy', { locale: id })}`, centerX, 33, { align: 'center' });
  doc.setLineWidth(0.5);
  doc.setDrawColor(121, 85, 72);
  doc.line(20, 36, pageWidth - 20, 36);

  const tableData = dataToPrint.map(item => [
    format(item.date.toDate(), 'dd/MM/yy', { locale: id }),
    item.time,
    item.subject,
    item.asrama,
    item.incident_description,
    item.improvement_efforts
  ]);

  autoTable(doc, {
    startY: 42,
    head: [['Tgl', 'Jam', 'Subjek', 'Lks/Asr', 'Kejadian', 'Upaya Perbaikan']],
    body: tableData,
    theme: 'grid',
    styles: {
      overflow: 'linebreak',
      cellPadding: 2,
      fontSize: 8,
      valign: 'top',
      font: 'helvetica'
    },
    headStyles: { fillColor: [62, 39, 35], textColor: [255, 255, 255], fontSize: 9, fontStyle: 'bold' },
    bodyStyles: { textColor: [50, 50, 50] },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 15 },
      2: { cellWidth: 40 },
      3: { cellWidth: 30 },
      4: { cellWidth: 'auto', halign: 'justify' },
      5: { cellWidth: 60, halign: 'justify' }
    },
    margin: { left: 20, right: 20 }
  });

  const finalY = (doc as any).lastAutoTable.finalY + 15;
  const pageHeight = doc.internal.pageSize.getHeight();
  
  doc.text(`Dicetak pada: ${format(new Date(), 'dd MMMM yyyy HH:mm', { locale: id })}`, 20, Math.min(finalY, pageHeight - 10));
  
  const signatureX = pageWidth - 60;
  const sigY = Math.min(finalY, pageHeight - 60);

  doc.text('Mengetahui,', signatureX, sigY, { align: 'center' });
  doc.text('Petugas Asrama', signatureX, sigY + 5, { align: 'center' });
  
  try {
    const qrDataUrl = await QRCode.toDataURL(userName);
    doc.addImage(qrDataUrl, 'PNG', signatureX - 12.5, sigY + 8, 25, 25);
  } catch (e) {
    console.error("QR Error", e);
  }
  
  doc.setFontSize(10);
  doc.text(userName, signatureX, sigY + 40, { align: 'center' });
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text('Digital Signature (Verified)', signatureX, sigY + 44, { align: 'center' });

  const fileName = `Laporan_Kejadian_Asrama_${period}_${Date.now()}.pdf`;

  if (Capacitor.isNativePlatform()) {
    try {
      const pdfBase64 = doc.output('datauristring').split(',')[1];
      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: pdfBase64,
        directory: Directory.Cache
      });
      await Share.share({
        title: 'Laporan Kejadian Asrama',
        url: savedFile.uri
      });
    } catch (error) {
      doc.save(fileName);
    }
  } else {
    doc.save(fileName);
  }
};

export const generatePinjamHPReportPDF = async (data: PinjamHP[], period: 'minggu' | 'bulan', userName: string) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const now = new Date();
  const { startOfWeek, startOfMonth, endOfDay } = await import('date-fns');
  const start = period === 'minggu' ? startOfWeek(now, { weekStartsOn: 1 }) : startOfMonth(now);
  const end = endOfDay(now);

  const dataToPrint = data.filter(item => {
    const d = item.tgl_pinjam?.toDate ? item.tgl_pinjam.toDate() : new Date();
    return d >= start && d <= end;
  }).sort((a, b) => {
    const da = a.tgl_pinjam?.toDate ? a.tgl_pinjam.toDate().getTime() : 0;
    const db = b.tgl_pinjam?.toDate ? b.tgl_pinjam.toDate().getTime() : 0;
    return da - db;
  });

  if (dataToPrint.length === 0) {
    alert('Tidak ada data untuk periode ini.');
    return;
  }

  const pageWidth = doc.internal.pageSize.getWidth();
  const centerX = pageWidth / 2;

  // Header Blue Theme KOP
  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59); // Slate-800
  doc.text('ASRAMA SRMA 24 KEDIRI', centerX, 15, { align: 'center' });
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('MONITORING PENGGUNAAN GADGET', centerX, 23, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105); // Slate-600
  doc.text(`Periode rekap: ${format(start, 'dd MMMM yyyy', { locale: id })} - ${format(end, 'dd MMMM yyyy', { locale: id })}`, centerX, 30, { align: 'center' });
  doc.setLineWidth(0.5);
  doc.setDrawColor(79, 70, 229); // Indigo-600
  doc.line(15, 33, pageWidth - 15, 33);

  const tableData = dataToPrint.map(item => [
    item.tgl_pinjam && typeof item.tgl_pinjam.toDate === 'function' ? format(item.tgl_pinjam.toDate(), 'dd/MM HH:mm', { locale: id }) : '-',
    item.nama_siswa,
    item.keperluan,
    item.wali_asuh_name || '-',
    item.status === 'dipinjam' ? 'AKTIF' : 'KEMBALI',
    item.tgl_kembali && typeof item.tgl_kembali.toDate === 'function' ? format(item.tgl_kembali.toDate(), 'dd/MM HH:mm', { locale: id }) : '-',
    item.penerima_kembali_name || '-'
  ]);

  autoTable(doc, {
    startY: 38,
    head: [['Waktu Pinjam', 'Nama Siswa', 'Keperluan', 'Peminjam (Wali Asuh)', 'Status', 'Waktu Kembali', 'Penerima Pengembalian']],
    body: tableData,
    theme: 'grid',
    styles: {
      overflow: 'linebreak',
      cellPadding: 1.5,
      fontSize: 7,
      valign: 'middle',
      font: 'helvetica'
    },
    headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontSize: 7, fontStyle: 'bold', halign: 'center' },
    bodyStyles: { textColor: [50, 50, 50] },
    columnStyles: {
      0: { cellWidth: 20 }, // Waktu Pinjam
      1: { cellWidth: 23 }, // Nama Siswa
      2: { cellWidth: 'auto', halign: 'justify' }, // Keperluan
      3: { cellWidth: 28 }, // Peminjam (Wali Asuh)
      4: { cellWidth: 14, halign: 'center' }, // Status
      5: { cellWidth: 20 }, // Waktu Kembali
      6: { cellWidth: 28 }  // Penerima Pengembalian
    },
    margin: { left: 10, right: 10 }
  });

  const finalY = (doc as any).lastAutoTable.finalY + 15;
  const pageHeight = doc.internal.pageSize.getHeight();
  
  doc.text(`Dicetak pada: ${format(new Date(), 'dd MMMM yyyy HH:mm', { locale: id })}`, 20, Math.min(finalY, pageHeight - 10));
  
  const signatureX = pageWidth - 60;
  const sigY = Math.min(finalY, pageHeight - 60);

  doc.text('Mengetahui,', signatureX, sigY, { align: 'center' });
  doc.text('Wali Asuh', signatureX, sigY + 5, { align: 'center' });
  
  try {
    const qrDataUrl = await QRCode.toDataURL(userName);
    doc.addImage(qrDataUrl, 'PNG', signatureX - 12.5, sigY + 8, 25, 25);
  } catch (e) {
    console.error("QR Error", e);
  }
  
  doc.setFontSize(10);
  doc.text(userName, signatureX, sigY + 40, { align: 'center' });
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text('Digital Signature (Verified)', signatureX, sigY + 44, { align: 'center' });

  const fileName = `Laporan_Pinjam_HP_${period}_${Date.now()}.pdf`;

  if (Capacitor.isNativePlatform()) {
    try {
      const pdfBase64 = doc.output('datauristring').split(',')[1];
      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: pdfBase64,
        directory: Directory.Cache
      });
      await Share.share({
        title: 'Laporan Pinjam HP',
        url: savedFile.uri
      });
    } catch (error) {
      doc.save(fileName);
    }
  } else {
    doc.save(fileName);
  }
};

export const generateProgressRecordReportPDF = async (data: ProgressRecord[], period: 'minggu' | 'bulan', userName: string) => {
  const doc = new jsPDF('l', 'mm', 'a4');
  const now = new Date();
  const { startOfWeek, startOfMonth, endOfDay } = await import('date-fns');
  const start = period === 'minggu' ? startOfWeek(now) : startOfMonth(now);
  const end = endOfDay(now);

  const dataToPrint = data.filter(item => {
    const d = item.tgl_catatan?.toDate ? item.tgl_catatan.toDate() : new Date();
    return d >= start && d <= end;
  }).sort((a, b) => {
    const da = a.tgl_catatan?.toDate ? a.tgl_catatan.toDate().getTime() : 0;
    const db = b.tgl_catatan?.toDate ? b.tgl_catatan.toDate().getTime() : 0;
    return da - db;
  });

  if (dataToPrint.length === 0) {
    alert('Tidak ada data untuk periode ini.');
    return;
  }

  const pageWidth = doc.internal.pageSize.getWidth();
  const centerX = pageWidth / 2;

  // Header Theme KOP
  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59);
  doc.text('ASRAMA SRMA 24 KEDIRI', centerX, 15, { align: 'center' });
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('REKAPITULASI CATATAN PERKEMBANGAN SISWA', centerX, 25, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(`Periode: ${format(start, 'dd MMMM yyyy', { locale: id })} - ${format(end, 'dd MMMM yyyy', { locale: id })}`, centerX, 33, { align: 'center' });
  doc.setLineWidth(0.5);
  doc.setDrawColor(99, 102, 241); // Indigo-500
  doc.line(20, 36, pageWidth - 20, 36);

  const tableData = dataToPrint.map(item => [
    format(item.tgl_catatan.toDate(), 'dd/MM/yyyy HH:mm', { locale: id }),
    item.nama_siswa,
    item.kelas,
    item.isi_catatan,
    item.author_name,
    item.is_acknowledged ? 'DITEERIMA' : 'PENDING'
  ]);

  autoTable(doc, {
    startY: 42,
    head: [['Waktu', 'Siswa', 'Kelas', 'Isi Catatan', 'Penulis', 'Status']],
    body: tableData,
    theme: 'grid',
    styles: { 
      overflow: 'linebreak', 
      cellPadding: 2, 
      fontSize: 8, 
      valign: 'top',
      font: 'helvetica',
      textColor: [50, 50, 50]
    },
    headStyles: { 
      fillColor: [99, 102, 241], 
      textColor: [255, 255, 255], 
      fontSize: 8, 
      fontStyle: 'bold',
      halign: 'center'
    },
    columnStyles: {
      0: { cellWidth: 25, halign: 'center' }, // Waktu
      1: { cellWidth: 40 }, // Siswa
      2: { cellWidth: 15, halign: 'center' }, // Kelas
      3: { cellWidth: 'auto', halign: 'justify' }, // Isi Catatan
      4: { cellWidth: 35 }, // Penulis
      5: { cellWidth: 25, halign: 'center' }  // Status
    },
    margin: { left: 15, right: 15 }
  });

  const finalY = (doc as any).lastAutoTable.finalY + 15;
  const pageHeight = doc.internal.pageSize.getHeight();
  
  doc.text(`Dicetak pada: ${format(new Date(), 'dd MMMM yyyy HH:mm', { locale: id })}`, 20, Math.min(finalY, pageHeight - 10));
  
  const signatureX = pageWidth - 60;
  const sigY = Math.min(finalY, pageHeight - 60);

  doc.text('Mengetahui,', signatureX, sigY, { align: 'center' });
  doc.text('Petugas', signatureX, sigY + 5, { align: 'center' });
  
  try {
    const qrDataUrl = await QRCode.toDataURL(userName);
    doc.addImage(qrDataUrl, 'PNG', signatureX - 12.5, sigY + 8, 25, 25);
  } catch (e) {
    console.error("QR Error", e);
  }
  
  doc.setFontSize(10);
  doc.text(userName, signatureX, sigY + 40, { align: 'center' });
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text('Digital Signature (Verified)', signatureX, sigY + 44, { align: 'center' });

  const fileName = `Rekap_Perkembangan_Siswa_${period}_${Date.now()}.pdf`;

  if (Capacitor.isNativePlatform()) {
    try {
      const pdfBase64 = doc.output('datauristring').split(',')[1];
      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: pdfBase64,
        directory: Directory.Cache
      });
      await Share.share({
        title: 'Rekap Perkembangan Siswa',
        url: savedFile.uri
      });
    } catch (error) {
      doc.save(fileName);
    }
  } else {
    doc.save(fileName);
  }
};

export const generateKetidakhadiranPDF = async (record: Ketidakhadiran) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // Page Border & Decor
  doc.setDrawColor(93, 64, 55); // Brown accent
  doc.setLineWidth(0.3);
  doc.rect(5, 5, 200, 287);

  // --- HEADER ---
  doc.setTextColor(62, 39, 35); // Dark brown
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('KEMENTERIAN SOSIAL REPUBLIK INDONESIA', 105, 18, { align: 'center' });
  doc.setFontSize(16);
  doc.text('SEKOLAH RAKYAT MENENGAH ATAS 24 KEDIRI', 105, 25, { align: 'center' });
  doc.setFontSize(12);
  doc.text('PORTAL WALI ASUH & WALI ASRAMA (GUARDIANS)', 105, 32, { align: 'center' });

  doc.setTextColor(120, 120, 120);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Gedung Balai Pengembangan Kompetensi Aparatur Sipil Negara', 105, 38, { align: 'center' });
  doc.text('Gg. 2 Bulusari Utara, Bulusari, Kec. Tarokan, Kab. Kediri, Jawa Timur', 105, 43, { align: 'center' });
  doc.text('Email: srma24kediri@gmail.com   |   Kode Pos: 64152', 105, 48, { align: 'center' });

  // Elegant double line
  doc.setDrawColor(62, 39, 35);
  doc.setLineWidth(0.8);
  doc.line(20, 52, 190, 52);
  doc.setLineWidth(0.2);
  doc.line(20, 53.5, 190, 53.5);

  // --- TITLE ---
  doc.setTextColor(62, 39, 35);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('LAPORAN CATATAN KETIDAKHADIRAN', 105, 65, { align: 'center' });
  doc.setLineWidth(0.5);
  doc.line(55, 67, 155, 67);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Nomor Dokumen: ${record.nomor_surat || '-'}`, 105, 73, { align: 'center' });

  // --- RECORD DETAILS ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('A. INFORMASI KEGIATAN ASRAMA', 20, 88);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  
  const col1X = 20;
  const colValX = 65;
  
  doc.text('Keterangan Kegiatan', col1X, 98);
  doc.setFont('helvetica', 'bold');
  doc.text(`: ${record.keterangan_kegiatan}`, colValX, 98);
  
  doc.setFont('helvetica', 'normal');
  doc.text('Kegiatan', col1X, 105);
  doc.setFont('helvetica', 'bold');
  doc.text(': Asrama', colValX, 105);

  doc.setFont('helvetica', 'normal');
  doc.text('Tanggal & Waktu', col1X, 112);
  const dateFormatted = record.tgl_absen?.toDate ? format(record.tgl_absen.toDate(), 'eeee, d MMMM yyyy • HH:mm', { locale: id }) : '-';
  doc.text(`: ${dateFormatted} WIB`, colValX, 112);

  // --- STUDENT LIST ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('B. DAFTAR SISWA YANG TIDAK HADIR', 20, 125);

  const studentTableData = record.daftar_siswa.map((student, idx) => [
    (idx + 1).toString(),
    student,
    record.kelas
  ]);

  autoTable(doc, {
    startY: 130,
    head: [['NO', 'NAMA SISWA', 'KELAS / ROMBEL']],
    body: studentTableData,
    theme: 'grid',
    headStyles: { fillColor: [93, 64, 55], textColor: [255, 255, 255] },
    styles: { fontSize: 9, font: 'helvetica' }
  });

  const nextY = (doc as any).lastAutoTable.finalY + 12;

  // --- DESKRIPSI / KETERANGAN ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('C. KETERANGAN / PENJELASAN TAMBAHAN', 20, nextY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const splitText = doc.splitTextToSize(record.deskripsi || 'Tidak ada keterangan tambahan.', 170);
  doc.text(splitText, 20, nextY + 7);

  const finalY = nextY + 7 + (splitText.length * 5) + 15;

  // Signatures
  const signatureX = 150;
  doc.text('Kediri, ' + format(new Date(), 'd MMMM yyyy'), signatureX, finalY, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  const roleText = record.author_role === 'wali_asuh' ? 'Wali Asuh' : 'Wali Asrama';
  doc.text(roleText + ' Pem buat Catatan,', signatureX, finalY + 5, { align: 'center' });

  // QR Code
  try {
    const qrDataUrl = await QRCode.toDataURL(`Catatan Ketidakhadiran - ID: ${record.id || 'N/A'}`);
    doc.addImage(qrDataUrl, 'PNG', signatureX - 12.5, finalY + 10, 25, 25);
  } catch (e) {
    console.error(e);
  }

  doc.text(record.author_name, signatureX, finalY + 41, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Digital Signature Verified', signatureX, finalY + 45, { align: 'center' });

  // Security note
  doc.setFontSize(8);
  doc.setTextColor(140, 140, 140);
  doc.text('Dokumen ini digenerate secara otomatis melalui SRMA 24 Dorm Guardian System.', 105, 275, { align: 'center' });

  const fileName = `Catatan_Ketidakhadiran_${(record.kelas || '').replace(/\s+/g, '_')}_${Date.now()}.pdf`;

  if (Capacitor.isNativePlatform()) {
    try {
      const pdfBase64 = doc.output('datauristring').split(',')[1];
      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: pdfBase64,
        directory: Directory.Cache
      });
      await Share.share({
        title: 'Laporan Ketidakhadiran',
        url: savedFile.uri
      });
    } catch (error) {
      doc.save(fileName);
    }
  } else {
    doc.save(fileName);
  }
};

export const generateKetidakhadiranReportPDF = async (
  records: Ketidakhadiran[],
  period: string,
  authorName: string = 'Wali Asuh / Wali Asrama',
  roleTitle: string = 'Guardian Portal'
) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // Border
  doc.setDrawColor(93, 64, 55);
  doc.setLineWidth(0.3);
  doc.rect(5, 5, 200, 287);

  // --- HEADER ---
  doc.setTextColor(62, 39, 35);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('KEMENTERIAN SOSIAL REPUBLIK INDONESIA', 105, 18, { align: 'center' });
  doc.setFontSize(16);
  doc.text('SEKOLAH RAKYAT MENENGAH ATAS 24 KEDIRI', 105, 25, { align: 'center' });
  doc.setFontSize(12);
  doc.text('REKAPITULASI CATATAN KETIDAKHADIRAN SISWA', 105, 32, { align: 'center' });

  doc.setTextColor(120, 120, 120);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Gedung Balai Pengembangan Kompetensi Aparatur Sipil Negara', 105, 38, { align: 'center' });
  doc.text('Gg. 2 Bulusari Utara, Bulusari, Kec. Tarokan, Kab. Kediri, Jawa Timur', 105, 43, { align: 'center' });
  doc.text(`Email: srma24kediri@gmail.com   |   Jenis Kegiatan: Rekap ${period}`, 105, 48, { align: 'center' });

  doc.setDrawColor(62, 39, 35);
  doc.setLineWidth(0.8);
  doc.line(20, 52, 190, 52);
  doc.setLineWidth(0.2);
  doc.line(20, 53.5, 190, 53.5);

  // Info
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`Periode Rekap : ${period}`, 20, 62);
  doc.setFont('helvetica', 'normal');
  doc.text(`Tanggal Cetak : ${format(new Date(), 'dd MMMM yyyy, HH:mm')} WIB`, 20, 67);
  doc.text(`Total Catatan : ${records.length} Laporan`, 20, 72);

  // Table Data
  const tableData = records.map((rec, index) => [
    (index + 1).toString(),
    rec.tgl_absen?.toDate ? format(rec.tgl_absen.toDate(), 'dd/MM/yy HH:mm') : '-',
    rec.keterangan_kegiatan || '-',
    rec.kelas || '-',
    rec.daftar_siswa.join(', '),
    rec.deskripsi || '-'
  ]);

  autoTable(doc, {
    startY: 78,
    head: [['NO', 'TANGGAL & WAKTU', 'KEGIATAN', 'KELAS', 'DAFTAR SISWA', 'KETERANGAN']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [62, 39, 35], textColor: [255, 255, 255], fontSize: 8 },
    styles: { fontSize: 7.5, font: 'helvetica', overflow: 'linebreak' },
    columnStyles: {
      0: { cellWidth: 8 },
      1: { cellWidth: 26 },
      2: { cellWidth: 26 },
      3: { cellWidth: 14 },
      4: { cellWidth: 60 },
      5: { cellWidth: 46 }
    }
  });

  const finalY = (doc as any).lastAutoTable.finalY + 15;

  // Footer signature
  const signatureX = 150;
  if (finalY < 230) {
    doc.setFontSize(9);
    doc.text('Kediri, ' + format(new Date(), 'd MMMM yyyy'), signatureX, finalY, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.text(roleTitle + ',', signatureX, finalY + 5, { align: 'center' });
    
    try {
      const qrDataUrl = await QRCode.toDataURL(`Rekap Absensi - Oleh: ${authorName}`);
      doc.addImage(qrDataUrl, 'PNG', signatureX - 12.5, finalY + 9, 23, 23);
    } catch (e) {
      console.error(e);
    }

    doc.text(authorName, signatureX, finalY + 39, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text('Digital Signature Verified', signatureX, finalY + 43, { align: 'center' });
  }

  const fileName = `Rekap_Ketidakhadiran_${period.replace(/\s+/g, '_')}_${Date.now()}.pdf`;

  if (Capacitor.isNativePlatform()) {
    try {
      const pdfBase64 = doc.output('datauristring').split(',')[1];
      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: pdfBase64,
        directory: Directory.Cache
      });
      await Share.share({
        title: `Rekap Ketidakhadiran ${period}`,
        url: savedFile.uri
      });
    } catch (error) {
      doc.save(fileName);
    }
  } else {
    doc.save(fileName);
  }
};

export const generateJurnalKeperawatanPDF = async (journal: JurnalKeperawatan) => {
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
  doc.setTextColor(62, 39, 35); // Deep Chocolate theme to match Jurnal Keperawatan UI
  doc.text('UNIT PELAYANAN KESEHATAN SEKOLAH (UKS) & ASRAMA', 105, 32, { align: 'center' });
  
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Gedung Balai Pengembangan Kompetensi Aparatur Sipil Negara', 105, 38, { align: 'center' });
  doc.text('Gg. 2 Bulusari Utara, Bulusari, Kec. Tarokan, Kab. Kediri, Jawa Timur', 105, 43, { align: 'center' });
  doc.text(`Email: srma24kediri@gmail.com   |   Kode Pos: 64152`, 105, 48, { align: 'center' });
  
  doc.setDrawColor(62, 39, 35);
  doc.setLineWidth(0.8);
  doc.line(20, 52, 190, 52);
  doc.setLineWidth(0.2);
  doc.line(20, 53.5, 190, 53.5);

  // --- TITLE ---
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('KARTU JURNAL REHABILITASI & PERAWATAN MEDIS PESERTA DIDIK', 105, 64, { align: 'center' });
  doc.setLineWidth(0.5);
  doc.line(40, 65.5, 170, 65.5);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Nomor Dokumen : JK-${journal.id || 'NEW'}-${Date.now().toString().slice(-6)}`, 105, 71, { align: 'center' });

  // --- STUDENT DETAILS PANEL ---
  doc.setFillColor(248, 245, 240); // Soft Warm Cream background
  doc.rect(20, 78, 170, 36, 'F');
  doc.setDrawColor(220, 210, 200);
  doc.rect(20, 78, 170, 36, 'S');

  // Details
  const startD = journal.tgl_mulai?.toDate ? journal.tgl_mulai.toDate() : new Date();
  const formatMulai = format(startD, 'dd MMMM yyyy (HH:mm)', { locale: id });
  
  const finishD = journal.tgl_sembuh?.toDate ? journal.tgl_sembuh.toDate() : null;
  const formatSembuh = finishD ? format(finishD, 'dd MMMM yyyy (HH:mm)', { locale: id }) : '-';

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(62, 39, 35);
  doc.text('INFORMASI PASIEN / PESERTA DIDIK', 24, 84);
  doc.line(24, 85, 80, 85);

  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold'); doc.text('Nama Lengkap', 24, 91);
  doc.setFont('helvetica', 'normal'); doc.text(`: ${journal.nama_siswa.toUpperCase()}`, 62, 91);
  
  doc.setFont('helvetica', 'bold'); doc.text('Kelas / Kamar', 24, 96);
  doc.setFont('helvetica', 'normal'); doc.text(`: Kelas ${journal.kelas}`, 62, 96);

  doc.setFont('helvetica', 'bold'); doc.text('Keterangan Sakit', 24, 101);
  doc.setFont('helvetica', 'normal'); doc.text(`: ${journal.keterangan_sakit}`, 62, 101, { maxWidth: 120 });

  doc.setFont('helvetica', 'bold'); doc.text('Mulai Dirawat', 24, 109);
  doc.setFont('helvetica', 'normal'); doc.text(`: ${formatMulai} WIB`, 62, 109);

  // Status Info inside box
  doc.setFont('helvetica', 'bold'); doc.text('Status Medis', 132, 91);
  const statusLabel = journal.status === 'sembuh' ? 'SIB Sembuh' : 'DIRAWAT / PEMANTAUAN';
  doc.setFont('helvetica', 'bold');
  if (journal.status === 'sembuh') {
    doc.setTextColor(16, 124, 65);
    doc.text('SEMBUH', 132, 96);
  } else {
    doc.setTextColor(180, 40, 40);
    doc.text('DALAM PERAWATAN', 132, 96);
  }

  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold'); doc.text('Tanggal Pulih', 132, 104);
  doc.setFont('helvetica', 'normal'); doc.text(formatSembuh, 132, 109);

  // --- SEPARATOR ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(62, 39, 35);
  doc.text('RIWAYAT TINDAKAN & PERKEMBANGAN MEDIS (CLINICAL TIMELINE)', 20, 122);
  doc.line(20, 123.5, 190, 123.5);

  // Actions Table Data
  const tableHeaders = [['NO', 'TANGGAL & WAKTU', 'TINDAKAN / PENANGANAN YANG DILAKUKAN', 'PETUGAS MEDIS / WALI']];
  const tableBody = (journal.penanganan || []).map((action, idx) => {
    const actD = action.waktu?.toDate ? action.waktu.toDate() : new Date();
    const formattedActD = format(actD, 'dd MMMM yyyy\nHH:mm', { locale: id });
    return [
      (idx + 1).toString(),
      formattedActD,
      action.tindakan || '-',
      `${action.oleh_name}\n(${action.oleh_role})`
    ];
  });

  autoTable(doc, {
    startY: 128,
    head: tableHeaders,
    body: tableBody,
    theme: 'grid',
    headStyles: { fillColor: [62, 39, 35], textColor: [255, 255, 255], fontSize: 8.5, fontStyle: 'bold' },
    styles: { fontSize: 8, font: 'helvetica', overflow: 'linebreak', cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 35 },
      2: { cellWidth: 85 },
      3: { cellWidth: 40 }
    }
  });

  // Calculate final pos
  let finalY = (doc as any).lastAutoTable.finalY + 15;
  if (finalY > 230) {
    doc.addPage();
    // Re-draw border on second page
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.1);
    doc.rect(5, 5, 200, 287);
    finalY = 25;
  }

  // --- SIGNATURE AREA ---
  const signatureX = 150;
  doc.setFontSize(9.5);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  doc.text('Kediri, ' + format(new Date(), 'd MMMM yyyy', { locale: id }), signatureX, finalY, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  const signerRole = journal.status === 'sembuh' ? 'TIM KESEHATAN / PENASUH' : 'MEMBER UNIT UKS';
  doc.text(signerRole + ',', signatureX, finalY + 5, { align: 'center' });
  
  // Add an authenticity QR Code
  try {
    const qrText = `VERIFIED_HEALTH_JOURNAL_${journal.id || 'NEW'}_Siswa:${journal.nama_siswa}_Status:${journal.status}`;
    const qrDataUrl = await QRCode.toDataURL(qrText);
    doc.addImage(qrDataUrl, 'PNG', signatureX - 12.5, finalY + 10, 25, 25);
  } catch (e) {
    console.error(e);
  }

  doc.setFont('helvetica', 'bold');
  doc.text(journal.created_by_name || 'Petugas UKS', signatureX, finalY + 41, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 100, 100);
  doc.text('Digital Identity Verified', signatureX, finalY + 45, { align: 'center' });

  // Page Footer security note
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text('Laporan Jurnal Keperawatan ini diterbitkan secara sah dan terekam dalam sistem informasi kesehatan SRMA 24.', 105, 276, { align: 'center' });
  doc.text('Semua tindakan medis yang tertulis di atas telah disetujui dan diawasi oleh tim medis sekolah.', 105, 280, { align: 'center' });

  const fileName = `Jurnal_Medis_${(journal.nama_siswa || '').replace(/\s+/g, '_')}_${Date.now()}.pdf`;

  if (Capacitor.isNativePlatform()) {
    try {
      const pdfBase64 = doc.output('datauristring').split(',')[1];
      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: pdfBase64,
        directory: Directory.Cache
      });
      await Share.share({
        title: `Jurnal Medis ${journal.nama_siswa}`,
        url: savedFile.uri
      });
    } catch (error) {
      console.error(error);
      doc.save(fileName);
    }
  } else {
    doc.save(fileName);
  }
};

export const generateJurnalKeperawatanSummaryPDF = async (
  journals: JurnalKeperawatan[],
  rangeLabel: string,
  userName: string = 'SRMA 24 KEDIRI'
) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // --- DESIGN: Border & Background ---
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.1);
  doc.rect(5, 5, 200, 287); // Page border
  
  // --- HEADER ---
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('KEMENTERIAN SOSIAL REPUBLIK INDONESIA', 105, 18, { align: 'center' });
  doc.setFontSize(16);
  doc.text('SEKOLAH RAKYAT MENENGAH ATAS 24 KEDIRI', 105, 25, { align: 'center' });
  doc.setFontSize(12);
  doc.setTextColor(62, 39, 35); // Deep Chocolate theme
  doc.text('UNIT PELAYANAN KESEHATAN SEKOLAH (UKS) & ASRAMA', 105, 32, { align: 'center' });
  
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Gedung Balai Pengembangan Kompetensi Aparatur Sipil Negara', 105, 38, { align: 'center' });
  doc.text('Gg. 2 Bulusari Utara, Bulusari, Kec. Tarokan, Kab. Kediri, Jawa Timur', 105, 43, { align: 'center' });
  doc.text(`Email: srma24kediri@gmail.com   |   Kode Pos: 64152`, 105, 48, { align: 'center' });
  
  doc.setDrawColor(62, 39, 35);
  doc.setLineWidth(0.8);
  doc.line(20, 52, 190, 52);
  doc.setLineWidth(0.2);
  doc.line(20, 53.5, 190, 53.5);

  // --- TITLE ---
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(`LAPORAN REKAPITULASI ${rangeLabel.toUpperCase()} JURNAL KEPERAWATAN`, 105, 64, { align: 'center' });
  doc.setLineWidth(0.5);
  doc.line(30, 65.5, 180, 65.5);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Tanggal Cetak: ${format(new Date(), 'dd MMMM yyyy, HH:mm', { locale: id })} WIB`, 105, 71, { align: 'center' });

  // --- REKAP STATS PANEL ---
  const activeCount = journals.filter(j => j.status === 'dirawat').length;
  const curedCount = journals.filter(j => j.status === 'sembuh').length;
  
  doc.setFillColor(248, 245, 240); // Soft Warm Cream background
  doc.rect(20, 78, 170, 22, 'F');
  doc.setDrawColor(220, 210, 200);
  doc.rect(20, 78, 170, 22, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(62, 39, 35);
  doc.text('RINGKASAN STATISTIK LAPORAN', 24, 84);
  doc.line(24, 85, 76, 85);

  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  doc.text(`Total Penanganan Kasus: ${journals.length} Pasien Peserta Didik`, 24, 91);
  doc.text(`Dalam Perawatan: ${activeCount} Pasien`, 24, 95);
  
  doc.text(`Sembuh / Selesai Rawat: ${curedCount} Pasien`, 110, 91);
  doc.text(`Petugas Penanggung Jawab: ${userName}`, 110, 95);

  // --- TABLE OF HEALTH RECORDS ---
  const tableHeaders = [['NO', 'PESERTA DIDIK / KELAS', 'KETERANGAN SAKIT', 'TGL MULAI', 'STATUS / PULIH', 'DAFTAR TINDAKAN PERAWATAN']];
  
  const tableBody = journals.map((j, idx) => {
    const startD = j.tgl_mulai?.toDate ? j.tgl_mulai.toDate() : new Date();
    const formattedStart = format(startD, 'dd/MM/yy', { locale: id });
    
    let formattedFinish = '-';
    if (j.status === 'sembuh' && j.tgl_sembuh) {
      const finishD = j.tgl_sembuh.toDate ? j.tgl_sembuh.toDate() : new Date();
      formattedFinish = format(finishD, 'dd/MM/yy', { locale: id });
    }

    const statusBadge = j.status === 'sembuh' ? `Sembuh\n(${formattedFinish})` : 'Dirawat';
    
    const actionsList = j.penanganan && j.penanganan.length > 0
      ? j.penanganan.map((action) => {
          const actD = action.waktu?.toDate ? action.waktu.toDate() : (action.waktu instanceof Date ? action.waktu : new Date());
          const formattedActD = format(actD, 'dd/MM HH:mm', { locale: id });
          return `• [${formattedActD}] ${action.tindakan} (${action.oleh_name})`;
        }).join('\n')
      : 'Belum ada tindakan';

    return [
      (idx + 1).toString(),
      `${j.nama_siswa.toUpperCase()}\nKelas: ${j.kelas}`,
      j.keterangan_sakit,
      formattedStart,
      statusBadge,
      actionsList
    ];
  });

  autoTable(doc, {
    startY: 108,
    head: tableHeaders,
    body: tableBody,
    theme: 'grid',
    headStyles: { fillColor: [62, 39, 35], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
    styles: { fontSize: 7, font: 'helvetica', overflow: 'linebreak', cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 32 },
      2: { cellWidth: 38 },
      3: { cellWidth: 15, halign: 'center' },
      4: { cellWidth: 20, halign: 'center' },
      5: { cellWidth: 57 }
    }
  });

  // Calculate final pos
  let finalY = (doc as any).lastAutoTable.finalY + 15;
  if (finalY > 230) {
    doc.addPage();
    // Re-draw border on second page
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.1);
    doc.rect(5, 5, 200, 287);
    finalY = 25;
  }

  // --- SIGNATURE AREA ---
  const signatureX = 150;
  doc.setFontSize(9.5);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  doc.text('Kediri, ' + format(new Date(), 'd MMMM yyyy', { locale: id }), signatureX, finalY, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.text('KOORDINATOR POSKESTREN / UKS,', signatureX, finalY + 5, { align: 'center' });
  
  // Add validation QR Code
  try {
    const qrText = `REKAP_HEALTH_JOURNAL_${rangeLabel.toUpperCase()}_Cetak_At:${Date.now()}_Oleh:${userName}`;
    const qrDataUrl = await QRCode.toDataURL(qrText);
    doc.addImage(qrDataUrl, 'PNG', signatureX - 12.5, finalY + 10, 25, 25);
  } catch (e) {
    console.error(e);
  }

  doc.setFont('helvetica', 'bold');
  doc.text(userName, signatureX, finalY + 41, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 100, 100);
  doc.text('Digital Signature Verified', signatureX, finalY + 45, { align: 'center' });

  // Page Footer security note
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text('Laporan Rekapitulasi Jurnal Keperawatan ini diterbitkan secara sah dan terekam dalam sistem informasi SRMA 24.', 105, 276, { align: 'center' });

  const fileName = `Rekap_${rangeLabel}_Jurnal_Keperawatan_${Date.now()}.pdf`;

  if (Capacitor.isNativePlatform()) {
    try {
      const pdfBase64 = doc.output('datauristring').split(',')[1];
      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: pdfBase64,
        directory: Directory.Cache
      });
      await Share.share({
        title: `Rekap ${rangeLabel} Jurnal Keperawatan`,
        url: savedFile.uri
      });
    } catch (error) {
      console.error(error);
      doc.save(fileName);
    }
  } else {
    doc.save(fileName);
  }
};

export const generateCounselingReportPDF = async (data: StudentCounseling[], periodLabel: string, userName: string) => {
  const doc = new jsPDF('l', 'mm', 'a4');
  const { format } = await import('date-fns');
  const { id } = await import('date-fns/locale');

  const dataToPrint = [...data].sort((a, b) => {
    const da = a.tgl_konseling?.toDate ? a.tgl_konseling.toDate().getTime() : 0;
    const db = b.tgl_konseling?.toDate ? b.tgl_konseling.toDate().getTime() : 0;
    return da - db;
  });

  if (dataToPrint.length === 0) {
    alert('Tidak ada data konseling untuk dicetak.');
    return;
  }

  const pageWidth = doc.internal.pageSize.getWidth();
  const centerX = pageWidth / 2;

  // Header Theme KOP
  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59);
  doc.text('ASRAMA SRMA 24 KEDIRI', centerX, 15, { align: 'center' });
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('REKAPITULASI CATATAN KONSELING SISWA', centerX, 25, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(`Periode: ${periodLabel}`, centerX, 33, { align: 'center' });
  doc.setLineWidth(0.5);
  doc.setDrawColor(16, 185, 129); // Emerald-500
  doc.line(20, 36, pageWidth - 20, 36);

  const tableData = dataToPrint.map(item => [
    item.tgl_konseling?.toDate ? format(item.tgl_konseling.toDate(), 'dd/MM/yyyy HH:mm', { locale: id }) : '-',
    item.siswa_name,
    item.kelas,
    item.kategori,
    item.permasalahan,
    item.solusi,
    item.perkembangan,
    item.author_name
  ]);

  autoTable(doc, {
    startY: 42,
    head: [['Waktu', 'Siswa', 'Kelas', 'Kategori', 'Permasalahan', 'Solusi', 'Perkembangan', 'Konselor']],
    body: tableData,
    theme: 'grid',
    styles: { 
      overflow: 'linebreak', 
      cellPadding: 2, 
      fontSize: 8, 
      valign: 'top',
      font: 'helvetica',
      textColor: [50, 50, 50]
    },
    headStyles: { 
      fillColor: [16, 185, 129], // Emerald-500
      textColor: [255, 255, 255], 
      fontSize: 8, 
      fontStyle: 'bold',
      halign: 'center'
    },
    columnStyles: {
      0: { cellWidth: 25, halign: 'center' }, // Waktu
      1: { cellWidth: 30 }, // Siswa
      2: { cellWidth: 12, halign: 'center' }, // Kelas
      3: { cellWidth: 20 }, // Kategori
      4: { cellWidth: 'auto', halign: 'justify' }, // Permasalahan
      5: { cellWidth: 'auto', halign: 'justify' }, // Solusi
      6: { cellWidth: 'auto', halign: 'justify' }, // Perkembangan
      7: { cellWidth: 25 } // Konselor
    },
    margin: { left: 15, right: 15 }
  });

  const finalY = (doc as any).lastAutoTable.finalY + 15;
  const pageHeight = doc.internal.pageSize.getHeight();
  
  doc.text(`Dicetak pada: ${format(new Date(), 'dd MMMM yyyy HH:mm', { locale: id })}`, 20, Math.min(finalY, pageHeight - 10));
  
  const signatureX = pageWidth - 60;
  const sigY = Math.min(finalY, pageHeight - 60);

  doc.text('Mengetahui,', signatureX, sigY, { align: 'center' });
  doc.text('Konselor / Wali Asuh', signatureX, sigY + 5, { align: 'center' });
  
  try {
    const qrDataUrl = await QRCode.toDataURL(userName);
    doc.addImage(qrDataUrl, 'PNG', signatureX - 12.5, sigY + 8, 25, 25);
  } catch (e) {
    console.error("QR Error", e);
  }
  
  doc.setFontSize(10);
  doc.text(userName, signatureX, sigY + 40, { align: 'center' });
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text('Digital Signature (Verified)', signatureX, sigY + 44, { align: 'center' });

  const fileName = `Rekap_Konseling_Siswa_${Date.now()}.pdf`;

  if (Capacitor.isNativePlatform()) {
    try {
      const pdfBase64 = doc.output('datauristring').split(',')[1];
      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: pdfBase64,
        directory: Directory.Cache
      });
      await Share.share({
        title: 'Rekap Konseling Siswa',
        url: savedFile.uri
      });
    } catch (error) {
      doc.save(fileName);
    }
  } else {
    doc.save(fileName);
  }
};

export const generateLossesReportPDF = async (data: DormitoryLoss[], periodLabel: string, userName: string) => {
  const doc = new jsPDF('l', 'mm', 'a4');
  const { format } = await import('date-fns');
  const { id } = await import('date-fns/locale');

  const dataToPrint = [...data].sort((a, b) => {
    const da = a.tgl_kehilangan?.toDate ? a.tgl_kehilangan.toDate().getTime() : 0;
    const db = b.tgl_kehilangan?.toDate ? b.tgl_kehilangan.toDate().getTime() : 0;
    return da - db;
  });

  if (dataToPrint.length === 0) {
    alert('Tidak ada data kehilangan untuk dicetak.');
    return;
  }

  const pageWidth = doc.internal.pageSize.getWidth();
  const centerX = pageWidth / 2;

  // Header Theme KOP (Nuansa Coklat #3e2723)
  doc.setFontSize(14);
  doc.setTextColor(62, 39, 35); // Dark Brown
  doc.text('ASRAMA SRMA 24 KEDIRI', centerX, 15, { align: 'center' });
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('REKAPITULASI CATATAN KEHILANGAN DI ASRAMA', centerX, 25, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(93, 64, 37); // Brown
  doc.text(`Periode: ${periodLabel}`, centerX, 33, { align: 'center' });
  doc.setLineWidth(0.5);
  doc.setDrawColor(93, 64, 37); // Brown
  doc.line(20, 36, pageWidth - 20, 36);

  const tableData = dataToPrint.map(item => [
    item.tgl_kehilangan?.toDate ? format(item.tgl_kehilangan.toDate(), 'dd/MM/yyyy HH:mm', { locale: id }) : '-',
    item.siswa_name,
    item.kelas,
    item.nama_barang,
    item.deskripsi_barang,
    item.lokasi_terakhir,
    item.status,
    item.perkembangan || '-',
    item.author_name
  ]);

  autoTable(doc, {
    startY: 42,
    head: [['Waktu Hilang', 'Siswa', 'Kelas', 'Nama Barang', 'Deskripsi Barang', 'Lokasi Terakhir', 'Status', 'Perkembangan/Tindak Lanjut', 'Pelapor']],
    body: tableData,
    theme: 'grid',
    styles: { 
      overflow: 'linebreak', 
      cellPadding: 2, 
      fontSize: 8, 
      valign: 'top',
      font: 'helvetica',
      textColor: [50, 50, 50]
    },
    headStyles: { 
      fillColor: [93, 64, 37], // Brown
      textColor: [255, 255, 255], 
      fontSize: 8, 
      fontStyle: 'bold',
      halign: 'center'
    },
    columnStyles: {
      0: { cellWidth: 25, halign: 'center' }, // Waktu Hilang
      1: { cellWidth: 25 }, // Siswa
      2: { cellWidth: 12, halign: 'center' }, // Kelas
      3: { cellWidth: 25 }, // Nama Barang
      4: { cellWidth: 40 }, // Deskripsi Barang
      5: { cellWidth: 25 }, // Lokasi Terakhir
      6: { cellWidth: 25, halign: 'center' }, // Status
      7: { cellWidth: 'auto' }, // Perkembangan
      8: { cellWidth: 25 } // Pelapor
    },
    margin: { left: 15, right: 15 }
  });

  const finalY = (doc as any).lastAutoTable.finalY + 15;
  const pageHeight = doc.internal.pageSize.getHeight();
  
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text(`Dicetak pada: ${format(new Date(), 'dd MMMM yyyy HH:mm', { locale: id })}`, 20, Math.min(finalY, pageHeight - 10));
  
  const signatureX = pageWidth - 60;
  const sigY = Math.min(finalY, pageHeight - 60);

  doc.setFontSize(10);
  doc.setTextColor(62, 39, 35);
  doc.text('Mengetahui,', signatureX, sigY, { align: 'center' });
  doc.text('Wali Asrama / Wali Asuh', signatureX, sigY + 5, { align: 'center' });
  
  try {
    const qrDataUrl = await QRCode.toDataURL(userName);
    doc.addImage(qrDataUrl, 'PNG', signatureX - 12.5, sigY + 8, 25, 25);
  } catch (e) {
    console.error("QR Error", e);
  }
  
  doc.setFontSize(10);
  doc.text(userName, signatureX, sigY + 40, { align: 'center' });
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text('Digital Signature (Verified)', signatureX, sigY + 44, { align: 'center' });

  const fileName = `Rekap_Kehilangan_Dormitory_${Date.now()}.pdf`;

  if (Capacitor.isNativePlatform()) {
    try {
      const pdfBase64 = doc.output('datauristring').split(',')[1];
      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: pdfBase64,
        directory: Directory.Cache
      });
      await Share.share({
        title: 'Rekap Kehilangan di Asrama',
        url: savedFile.uri
      });
    } catch (error) {
      doc.save(fileName);
    }
  } else {
    doc.save(fileName);
  }
};

interface CatatanBerobat {
  id?: string;
  siswa_id: string;
  siswa_name: string;
  kelas: string;
  keluhan: string;
  tindakan: string;
  tgl_kunjungan: any;
  author_name: string;
  author_uid: string;
  createdAt?: any;
}

export const generateUksReportPDF = async (records: CatatanBerobat[], periodLabel: string, userName: string) => {
  const doc = new jsPDF();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('REKAPITULASI CATATAN BEROBAT JUMPA DI UKS', 105, 20, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Periode: ${periodLabel}`, 105, 26, { align: 'center' });

  const tableData = records.map((record, index) => {
    let tglStr = '-';
    if (record.tgl_kunjungan) {
      const dt = record.tgl_kunjungan.toDate ? record.tgl_kunjungan.toDate() : new Date(record.tgl_kunjungan);
      tglStr = dt.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    return [
      index + 1,
      tglStr,
      record.siswa_name,
      record.kelas,
      record.keluhan,
      record.tindakan,
      record.author_name
    ];
  });

  autoTable(doc, {
    startY: 32,
    head: [['No', 'Tanggal', 'Nama Siswa', 'Kelas', 'Keluhan / Penyakit', 'Tindakan / Obat', 'Petugas/Wali']],
    body: tableData,
    theme: 'grid',
    styles: { fontSize: 8 }
  });

  doc.save(`Rekap_Berobat_UKS_${Date.now()}.pdf`);
};

export const generateLaporanPerkembanganPDF = async (report: LaporanPerkembanganSiswa) => {
  const doc = new jsPDF();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('LAPORAN PERKEMBANGAN ANANDA BERKALA', 105, 20, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Periode Bulan: ${report.periode_bulan}`, 105, 26, { align: 'center' });

  const data = [
    ['Nama Siswa', report.nama_siswa],
    ['Kelas / Kamar', `${report.kelas} / ${report.kamar}`],
    ['Wali Asuh', report.wali_asuh_name],
    ['Aspek Karakter (A)', `[Score: ${report.aspek_a_score}] ${report.aspek_a_catatan}`],
    ['Aspek Ibadah (B)', `[Score: ${report.aspek_b_score}] ${report.aspek_b_catatan}`],
    ['Aspek Kemandirian (C)', `[Score: ${report.aspek_c_score}] ${report.aspek_c_catatan}`],
    ['Aspek Fisik & Kesehatan (D)', `[Kondisi: ${report.aspek_d_kondisi}] ${report.aspek_d_catatan}`],
    ['Apresiasi Wali Asuh', report.apresiasi_wali_asuh],
    ['Rekomendasi Sinergi', report.rekomendasi_sinergi]
  ];

  autoTable(doc, {
    startY: 34,
    body: data,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 4 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60 } }
  });

  doc.save(`Laporan_Perkembangan_${report.nama_siswa.replace(/\s+/g, '_')}.pdf`);
};

export const generateKunjunganOrangTuaPDF = async (visits: KunjunganOrangTua[], periodLabel: string, userName: string, customVisitTitle: string) => {
  const doc = new jsPDF();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(customVisitTitle || 'REKAPITULASI KUNJUNGAN ORANG TUA SISWA', 105, 20, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Periode: ${periodLabel}`, 105, 26, { align: 'center' });

  const tableData = visits.map((v, index) => {
    let tglStr = '-';
    if (v.tgl_kunjungan) {
      const dt = v.tgl_kunjungan.toDate ? v.tgl_kunjungan.toDate() : new Date(v.tgl_kunjungan as any);
      tglStr = dt.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    return [
      index + 1,
      tglStr,
      v.siswa_name,
      v.kelas,
      v.nama_ortu,
      v.author_name
    ];
  });

  autoTable(doc, {
    startY: 32,
    head: [['No', 'Tanggal Kunjungan', 'Nama Siswa', 'Kelas', 'Nama Orang Tua / Pengunjung', 'Pencatat']],
    body: tableData,
    theme: 'grid',
    styles: { fontSize: 9 }
  });

  doc.save(`Rekap_Kunjungan_OT_${Date.now()}.pdf`);
};

export const generateSKPPDF = async (report: SKPReport) => {
  const doc = new jsPDF();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('LAPORAN BIMBINGAN DAN PENGASUHAN (SKP)', 105, 20, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  let tglStr = '-';
  if (report.tanggal_kegiatan) {
    const dt = report.tanggal_kegiatan.toDate ? report.tanggal_kegiatan.toDate() : new Date(report.tanggal_kegiatan as any);
    tglStr = dt.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }
  doc.text(`Hari, Tanggal: ${tglStr}`, 105, 26, { align: 'center' });

  const bodyData = [
    ['Kegiatan Yang Dilaksanakan', report.kegiatan_dilaksanakan],
    ['Hasil Yang Dicapai', report.hasil_dicapai],
    ['Kesimpulan & Saran', report.kesimpulan_saran],
    ['Wali Asuh / Penguji', report.author_name],
    ['Email', report.author_email]
  ];

  autoTable(doc, {
    startY: 34,
    body: bodyData,
    theme: 'grid',
    styles: { fontSize: 10, cellPadding: 5 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } }
  });

  let currentY = (doc as any).lastAutoTable.finalY + 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('DOKUMENTASI FOTO KEGIATAN:', 15, currentY);
  currentY += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  const photos = [report.foto_1, report.foto_2, report.foto_3, report.foto_4].filter(Boolean);
  if (photos.length > 0) {
    let photoIndex = 1;
    for (const imgUrl of photos) {
      if (imgUrl.startsWith('data:image/') || imgUrl.startsWith('blob:')) {
        try {
          doc.addImage(imgUrl, 'JPEG', 15 + ((photoIndex - 1) % 2) * 90, currentY + Math.floor((photoIndex - 1) / 2) * 55, 80, 50);
          photoIndex++;
        } catch (err) {
          doc.text(`- [Lampiran Foto ${photoIndex} attached in memory / local device only]`, 15, currentY);
          currentY += 4;
          photoIndex++;
        }
      }
    }
  } else {
    doc.text('- Tidak ada foto terlampir -', 15, currentY);
  }

  doc.save(`SKP_Laporan_${Date.now()}.pdf`);
};

export const generateSopRecapPDF = async (sops: SOP[], userName: string) => {
  const doc = new jsPDF();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('ARSIP STANDAR OPERASIONAL PROSEDUR (SOP) ASRAMA', 105, 20, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Penerbit / Auditor: ${userName}`, 105, 26, { align: 'center' });

  const tableData = sops.map((sop, index) => {
    let tglStr = '-';
    if (sop.tanggal_tetap) {
      const dt = sop.tanggal_tetap.toDate ? sop.tanggal_tetap.toDate() : new Date(sop.tanggal_tetap as any);
      tglStr = dt.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    return [
      index + 1,
      sop.nomor,
      sop.judul,
      sop.kategori,
      tglStr,
      sop.deskripsi
    ];
  });

  autoTable(doc, {
    startY: 32,
    head: [['No', 'Nomor SOP', 'Judul SOP', 'Kategori', 'Tanggal Ditetapkan', 'Deskripsi Ringkas']],
    body: tableData,
    theme: 'grid',
    styles: { fontSize: 8 }
  });

  doc.save(`Rekap_SOP_Asrama_${Date.now()}.pdf`);
};

interface HairRecord {
  siswa_id: string;
  siswa_name: string;
  kelas: string;
  tgl_potong: any;
  author_name: string;
  author_uid: string;
  createdAt: any;
}

export const generateHaircutsReportPDF = async (records: HairRecord[], periodLabel: string, userName: string) => {
  const doc = new jsPDF();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('REKAPITULASI PEMOTONGAN RAMBUT SISWA', 105, 20, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Periode Rekap: ${periodLabel}`, 105, 26, { align: 'center' });

  const tableData = records.map((record, index) => {
    let tglStr = '-';
    if (record.tgl_potong) {
      const dt = record.tgl_potong.toDate ? record.tgl_potong.toDate() : new Date(record.tgl_potong);
      tglStr = dt.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    return [
      index + 1,
      tglStr,
      record.siswa_name,
      record.kelas,
      record.author_name
    ];
  });

  autoTable(doc, {
    startY: 32,
    head: [['No', 'Tanggal Potong', 'Nama Lengkap Siswa', 'Kelas', 'Petugas Pencatat']],
    body: tableData,
    theme: 'grid',
    styles: { fontSize: 9 }
  });

  doc.save(`Rekap_Potong_Rambut_${Date.now()}.pdf`);
};

// --- PRIVATE INDONESIAN DATE TRANSLATION HELPERS ---
const formatIndoMonthStr = (monthStr: string) => {
  if (!monthStr) return '';
  const [year, month] = monthStr.split('-');
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  const monthIdx = parseInt(month, 10) - 1;
  return `${months[monthIdx] || ''} ${year}`;
};

const formatIndoDateStr = (dateStr: string) => {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  const monthIdx = parseInt(month, 10) - 1;
  return `${day} ${months[monthIdx] || ''} ${year}`;
};

// --- ATTENDANCE SYSTEM PDF GENERATORS ---

export const generateAbsenHarianPDF = async (record: AbsenHarianRecord) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // Page Border
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.1);
  doc.rect(5, 5, 200, 287);

  // Header
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('PRESENCE RECORDING SYSTEM', 105, 18, { align: 'center' });
  doc.setFontSize(16);
  doc.text('SRMA 24 KEDIRI', 105, 25, { align: 'center' });
  doc.setFontSize(11);
  doc.setTextColor(115, 78, 54); // Theme brown color
  doc.text('LAPORAN KEHADIRAN HARIAN SISWA', 105, 32, { align: 'center' });

  // Double horizontal lines
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.8);
  doc.line(15, 38, 195, 38);
  doc.setLineWidth(0.2);
  doc.line(15, 39.5, 195, 39.5);

  // Metadata information
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');

  doc.text('Tanggal Sesi', 15, 48);
  doc.setFont('helvetica', 'bold');
  doc.text(`: ${formatIndoDateStr(record.tanggal_str)}`, 45, 48);

  doc.setFont('helvetica', 'normal');
  doc.text('Mata Pelajaran', 15, 54);
  doc.setFont('helvetica', 'bold');
  doc.text(`: ${record.mapel.toUpperCase()}`, 45, 54);

  doc.setFont('helvetica', 'normal');
  doc.text('Kelas', 115, 48);
  doc.setFont('helvetica', 'bold');
  doc.text(`: Kelas ${record.kelas}`, 145, 48);

  doc.setFont('helvetica', 'normal');
  doc.text('Guru Pengampu', 115, 54);
  doc.setFont('helvetica', 'bold');
  doc.text(`: ${record.guru_name}`, 145, 54);

  // Agenda/Keterangan
  doc.setFont('helvetica', 'normal');
  doc.text('KBM / Agenda', 15, 60);
  doc.setFont('helvetica', 'italic');
  doc.text(`: "${record.keterangan || 'KBM Harian Standard'}"`, 45, 60);

  // Table Data
  const tableData = record.students.map((sts, idx) => [
    (idx + 1).toString(),
    sts.nama_siswa.toUpperCase(),
    sts.status === 'Hadir' ? 'HADIR' : 'ABSEN (TIDAK HADIR)'
  ]);

  autoTable(doc, {
    startY: 68,
    margin: { left: 15, right: 15 },
    head: [['NO', 'NAMA LENGKAP SISWA', 'STATUS KEHADIRAN']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [62, 39, 35], // #3e2723
      textColor: [253, 252, 240], // #fdfcf0
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'center'
    },
    styles: {
      fontSize: 8.5,
      cellPadding: 2.5
    },
    columnStyles: {
      0: { cellWidth: 15, halign: 'center' },
      1: { fontStyle: 'bold' },
      2: { halign: 'center' }
    }
  });

  const finalY = (doc as any).lastAutoTable.finalY + 10;

  // Stats Summary Box
  const summaryBoxY = finalY;
  doc.setDrawColor(220, 220, 220);
  doc.setFillColor(250, 250, 249);
  doc.rect(15, summaryBoxY, 180, 10, 'F');
  doc.setTextColor(60, 60, 60);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text(`Jumlah Siswa Diabsen: ${record.students.length}`, 20, summaryBoxY + 6.5);
  doc.setTextColor(16, 185, 129); // emerald-600
  doc.text(`Hadir: ${record.jumlah_hadir}`, 105, summaryBoxY + 6.5);
  doc.setTextColor(225, 29, 72); // rose-600
  doc.text(`Tidak Hadir: ${record.jumlah_absen}`, 150, summaryBoxY + 6.5);

  // Signature Block
  const signY = summaryBoxY + 15;
  if (signY + 40 < 280) { // Check that fits on current page
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Surabaya, ${formatIndoDateStr(record.tanggal_str)}`, 140, signY);
    doc.text('Guru Mata Pelajaran,', 140, signY + 5);
    
    // Line for signature
    doc.line(140, signY + 25, 190, signY + 25);
    doc.setFont('helvetica', 'bold');
    doc.text(record.guru_name, 140, signY + 29);
  }

  // Save / Share flow
  const fileName = `Laporan_Absen_Harian_Kelas_${record.kelas}_${record.tanggal_str}.pdf`;
  if (Capacitor.isNativePlatform()) {
    try {
      const pdfBase64 = doc.output('datauristring').split(',')[1];
      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: pdfBase64,
        directory: Directory.Cache
      });
      await Share.share({
        title: 'Laporan Absen Harian',
        text: `Laporan Kehadiran Siswa Kelas ${record.kelas} - ${record.tanggal_str}`,
        url: savedFile.uri,
        dialogTitle: 'Simpan atau Bagikan Laporan Absen'
      });
    } catch (error) {
      console.error("Capacitor Share Error:", error);
      doc.save(fileName);
    }
  } else {
    doc.save(fileName);
  }
};

export const generateAbsenBulananPDF = async (
  monthStr: string,
  kelas: string,
  records: AbsenHarianRecord[],
  studentsPool: Siswa[],
  currentUserName: string
) => {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  // Page Border (landscape version)
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.1);
  doc.rect(5, 5, 287, 200);

  // Header
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('SISTEM PRESENSI REAL-TIME', 148, 18, { align: 'center' });
  doc.setFontSize(16);
  doc.text('SRMA 24 KEDIRI', 148, 25, { align: 'center' });
  doc.setFontSize(11);
  doc.setTextColor(115, 78, 54); // Theme brown color
  doc.text('REKAPITULASI KEHADIRAN BULANAN SISWA', 148, 32, { align: 'center' });

  // Double horizontal lines
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.8);
  doc.line(15, 38, 282, 38);
  doc.setLineWidth(0.2);
  doc.line(15, 39.5, 282, 39.5);

  // Metadata information
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');

  doc.text('Bulan Rekap', 15, 48);
  doc.setFont('helvetica', 'bold');
  doc.text(`: ${formatIndoMonthStr(monthStr)}`, 45, 48);

  doc.setFont('helvetica', 'normal');
  doc.text('Kelas Pembelajaran', 15, 54);
  doc.setFont('helvetica', 'bold');
  doc.text(`: Kelas ${kelas}`, 45, 54);

  doc.setFont('helvetica', 'normal');
  doc.text('Pendidik Pembuat', 180, 48);
  doc.setFont('helvetica', 'bold');
  doc.text(`: ${currentUserName}`, 210, 48);

  doc.setFont('helvetica', 'normal');
  doc.text('Keadaan Kelas', 180, 54);
  doc.setFont('helvetica', 'bold');
  doc.text(`: Terdata ${studentsPool.length} Siswa`, 210, 54);

  // Gather unique session dates sorted
  const recordedDates = Array.from(new Set(records.map(r => r.tanggal_str))).sort();

  // Columns & Headers
  const columns = ['NO', 'NAMA LENGKAP SISWA'];
  recordedDates.forEach(dateStr => {
    const day = dateStr.slice(8, 10); // extract day e.g., "12"
    columns.push(day);
  });
  columns.push('HADIR (H)', 'ABSEN (A)');

  // Rows mapping
  const tableRows = studentsPool.map((student, idx) => {
    const row = [(idx + 1).toString(), student.nama_lengkap.toUpperCase()];
    let totalHadir = 0;
    let totalAbsen = 0;

    recordedDates.forEach(dateStr => {
      const rec = records.find(r => r.tanggal_str === dateStr);
      if (!rec) {
        row.push('-');
        return;
      }
      const match = rec.students?.find(
        s => s.siswa_id === student.id || s.nama_siswa.toLowerCase() === student.nama_lengkap.toLowerCase()
      );
      if (!match) {
        row.push('-');
      } else if (match.status === 'Hadir') {
        totalHadir++;
        row.push('O'); // Check symbol or O
      } else {
        totalAbsen++;
        row.push('X'); // or X for absent
      }
    });

    row.push(`${totalHadir} Sesi`, `${totalAbsen} Sesi`);
    return row;
  });

  // Calculate dynamic typography/sizing to fit elegantly
  const dateColsCount = recordedDates.length;
  let dynamicFontSize = 8;
  let dynamicPadding = 2.5;
  if (dateColsCount > 20) {
    dynamicFontSize = 6;
    dynamicPadding = 1.2;
  } else if (dateColsCount > 12) {
    dynamicFontSize = 7;
    dynamicPadding = 1.8;
  }

  // Handle empty state beautifully
  let headRows = [columns];
  let bodyRows = tableRows;
  if (recordedDates.length === 0) {
    headRows = [['NO', 'NAMA LENGKAP SISWA', 'KETERANGAN REKAP BULANAN']];
    bodyRows = [['-', '-', 'TIDAK ADA DATA ABSENSI TEREKAM SEPANJANG BULAN INI']];
  }

  autoTable(doc, {
    startY: 61,
    margin: { left: 15, right: 15 },
    head: headRows,
    body: bodyRows,
    theme: 'grid',
    headStyles: {
      fillColor: [62, 39, 35], // #3e2723
      textColor: [253, 252, 240], // #fdfcf0
      fontStyle: 'bold',
      fontSize: dynamicFontSize,
      halign: 'center',
      valign: 'middle'
    },
    styles: {
      fontSize: dynamicFontSize,
      cellPadding: dynamicPadding
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { fontStyle: 'bold', minCellWidth: 40 }
    }
  });

  const finalY = (doc as any).lastAutoTable.finalY + 10;

  // Signature Block (Landscape style, aligned to the bottom right)
  const signY = finalY;
  if (signY + 35 < 195) {
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Surabaya, Akhir ${formatIndoMonthStr(monthStr)}`, 220, signY);
    doc.text('Guru Mata Pelajaran,', 220, signY + 5);

    doc.line(220, signY + 23, 275, signY + 23);
    doc.setFont('helvetica', 'bold');
    doc.text(currentUserName, 220, signY + 27);
  }

  // Save / Share flow
  const fileName = `Rekap_Absen_Bulanan_Kelas_${kelas}_${monthStr}.pdf`;
  if (Capacitor.isNativePlatform()) {
    try {
      const pdfBase64 = doc.output('datauristring').split(',')[1];
      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: pdfBase64,
        directory: Directory.Cache
      });
      await Share.share({
        title: 'Cetak Rekap Bulanan',
        text: `Rekap Bulanan Kehadiran Siswa Kelas ${kelas} - ${monthStr}`,
        url: savedFile.uri,
        dialogTitle: 'Simpan atau Bagikan Rekap Absen'
      });
    } catch (error) {
      console.error("Capacitor Share Error:", error);
      doc.save(fileName);
    }
  } else {
    doc.save(fileName);
  }
};





