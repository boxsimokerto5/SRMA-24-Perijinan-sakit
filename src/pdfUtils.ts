import { jsPDF } from 'jspdf';
import { format } from 'date-fns';
import { IzinSakit, Memorandum, LaptopRequest, HPRequest, HealthCheckProposal } from './types';
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

export const generateSummaryReportPDF = async (permits: IzinSakit[], rangeLabel: string, userName: string = 'SRMA 24 KEDIRI') => {
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
  doc.text('Kepala Sekolah,', 150, footerY + 5, { align: 'center' });
  
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

