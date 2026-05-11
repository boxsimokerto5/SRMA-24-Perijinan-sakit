import { jsPDF } from 'jspdf';
import { format } from 'date-fns';
import { IzinSakit, Memorandum, LaptopRequest, HPRequest, HealthCheckProposal, SarprasReport, MonthlyReport, ProgressRecord } from './types';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import QRCode from 'qrcode';
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
      value: permit.catatan_kamar || 'Kamar Santri' 
    });
  }

  let currentY = startY;
  details.forEach((item) => {
    doc.setFont('helvetica', 'bold');
    doc.text(item.label, labelX, currentY);
    
    doc.setFont('helvetica', 'normal');
    const valueText = `:  ${item.value}`;
    const maxWidth = 190 - valueX;
    
    // Wrap text functionality
    const splitValue = doc.splitTextToSize(valueText, maxWidth);
    doc.text(splitValue, valueX, currentY);
    
    // Calculate how much space this took (roughly 5mm per line)
    const rowHeight = Math.max(lineGap, splitValue.length * 5);
    
    doc.setDrawColor(230, 230, 230);
    doc.line(valueX, currentY + (splitValue.length > 1 ? (splitValue.length * 5) - 3.5 : 1.5), 190, currentY + (splitValue.length > 1 ? (splitValue.length * 5) - 3.5 : 1.5));
    
    currentY += rowHeight + 2;
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

  // --- TABLE HEADER ---
  const tableTop = 75;
  doc.setFillColor(240, 240, 240);
  doc.rect(20, tableTop, 170, 10, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8); // Smaller font for table
  doc.text('NO', 23, tableTop + 6.5);
  doc.text('NAMA SISWA', 32, tableTop + 6.5);
  doc.text('KELAS', 75, tableTop + 6.5);
  doc.text('TIPE', 90, tableTop + 6.5);
  doc.text('DIAGNOSA / KETERANGAN', 110, tableTop + 6.5);
  doc.text('TANGGAL', 165, tableTop + 6.5);

  // --- TABLE ROWS ---
  let currentY = tableTop + 10;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  
  permits.forEach((p, index) => {
    if (currentY > 260) {
      doc.addPage();
      currentY = 20;
      // Border & Header on New Page
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.1);
      doc.rect(5, 5, 200, 287);
    }
    
    doc.text((index + 1).toString(), 23, currentY + 6.5);
    doc.text((p.nama_siswa || '').substring(0, 25), 32, currentY + 6.5);
    doc.text(p.kelas || '', 75, currentY + 6.5);
    doc.text((p.tipe || '').toUpperCase(), 90, currentY + 6.5);
    
    const diagnosaText = (p.diagnosa || p.alasan || p.isi_catatan || '-');
    const truncatedDiagnoasa = diagnosaText.length > 30 ? diagnosaText.substring(0, 27) + '...' : diagnosaText;
    doc.text(truncatedDiagnoasa, 110, currentY + 6.5);
    
    const tgl = p.tgl_surat && typeof p.tgl_surat.toDate === 'function' ? format(p.tgl_surat.toDate(), 'dd/MM/yy') : '-';
    doc.text(tgl, 165, currentY + 6.5);
    
    doc.setDrawColor(230, 230, 230);
    doc.line(20, currentY + 10, 190, currentY + 10);
    currentY += 10;
  });

  // --- SIGNATURE ---
  const footerY = Math.min(currentY + 20, 230);
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
  const capTexts = doc.splitTextToSize(report.capaian_khusus || '-', 145);
  doc.text(capTexts, 47, currentY);
  currentY += (capTexts.length * 5) + 8;

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
  const msgTexts = doc.splitTextToSize(`"${report.pesan_wali_asuh || '-'}"`, 165);
  doc.text(msgTexts, 25, currentY + 4);
  currentY += (msgTexts.length * 6) + 12;

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
  const splitOpening = doc.splitTextToSize(openingText, 170);
  doc.text(splitOpening, 20, 116);

  // Student Data Table
  const tableTop = 130;
  doc.setFont('helvetica', 'bold');
  doc.text('Nama Lengkap', 30, tableTop + 5);
  doc.text('Kelas / Jurusan', 30, tableTop + 13);
  doc.text('Isi Catatan', 30, tableTop + 21);

  doc.setFont('helvetica', 'normal');
  doc.text(`: ${record.nama_siswa.toUpperCase()}`, 70, tableTop + 5);
  doc.text(`: ${record.kelas}`, 70, tableTop + 13);
  
  const splitContent = doc.splitTextToSize(record.isi_catatan, 110);
  doc.text(':', 70, tableTop + 21);
  doc.text(splitContent, 73, tableTop + 21);

  doc.setDrawColor(220, 220, 220);
  doc.line(30, tableTop + 8, 190, tableTop + 8);
  doc.line(30, tableTop + 16, 190, tableTop + 16);
  const tableBottom = Math.max(tableTop + 24, tableTop + 18 + (splitContent.length * 5.5));
  doc.line(30, tableBottom, 190, tableBottom);

  const closingY = tableBottom + 12;
  doc.setFontSize(10);
  const closingText1 = 'Catatan ini diberikan sebagai bentuk perhatian dan koordinasi antara Wali Kelas dan Wali Asuh demi kebaikan proses belajar siswa yang bersangkutan. Mohon untuk dapat diperhatikan dan ditindaklanjuti sebagaimana mestinya.';
  const splitClosing1 = doc.splitTextToSize(closingText1, 170);
  doc.text(splitClosing1, 20, closingY);
  
  const closingText2 = 'Demikian surat keterangan ini diberikan agar dapat dipergunakan sebagaimana mestinya. Atas perhatian Bapak/Ibu, kami sampaikan terima kasih.';
  const splitClosing2 = doc.splitTextToSize(closingText2, 170);
  doc.text(splitClosing2, 20, closingY + 20);

  const sigY = closingY + 45;
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

