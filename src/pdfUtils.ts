import { jsPDF } from 'jspdf';
import { format } from 'date-fns';
import { IzinSakit } from './types';

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

  // Logo (Top Left)
  const logoUrl = "https://kemensos.go.id/uploads/topics/15694002662052.jpg";
  try {
    await new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = logoUrl;
    });
    doc.addImage(logoUrl, 'JPEG', 20, 18, 22, 22);
  } catch (e) {
    console.error("Failed to load logo image:", e);
  }

  // Kop Surat
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('KEMENTERIAN SOSIAL REPUBLIK INDONESIA', 110, 23, { align: 'center' });
  doc.setFontSize(12);
  doc.text('SEKOLAH RAKYAT MENENGAH ATAS 24 KEDIRI', 110, 28, { align: 'center' });
  doc.setFontSize(11);
  doc.text('UNIT PELAYANAN KESEHATAN SEKOLAH', 110, 33, { align: 'center' });
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Gedung Balai Pengembangan Kompetensi Aparatur Sipil Negara', 110, 38, { align: 'center' });
  doc.text('Gg. 2 Bulusari Utara, Bulusari, Kec. Tarokan, Kab. Kediri, Jawa Timur', 110, 42, { align: 'center' });
  doc.text(`Pos-el: srma24kediri@gmail.com   Kode Pos: 64152`, 110, 46, { align: 'center' });
  
  doc.setLineWidth(0.5);
  doc.line(20, 50, 190, 50);

  // Judul
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('SURAT KETERANGAN SAKIT', 105, 60, { align: 'center' });
  doc.setLineWidth(0.2);
  doc.line(80, 61, 130, 61); // Underline title
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Nomor : ${permit.nomor_surat}`, 105, 66, { align: 'center' });

  // Kepada Yth section
  doc.setFontSize(10);
  doc.text('Kepada Yth.', 20, 76);
  doc.setFont('helvetica', 'bold');
  doc.text(`Bapak/Ibu ${permit.nama_wali_kelas} - Wali Kelas ${permit.kelas}`, 20, 81);
  doc.setFont('helvetica', 'normal');
  doc.text('Sekolah Rakyat Menengah Atas 24 Kediri', 20, 86);
  doc.text('di Tempat', 20, 91);

  // Opening
  doc.setFontSize(10);
  doc.text('Dengan hormat,', 20, 101);
  const openingText = `Saya yang bertanda tangan di bawah ini selaku Perawat Unit Pelayanan Kesehatan Sekolah SRMA 24 Kediri, menerangkan bahwa :`;
  doc.text(openingText, 20, 107, { maxWidth: 170 });

  // Details
  const startY = 117;
  const lineGap = 6;
  doc.text('Nama', 20, startY);
  doc.text(`:  ${permit.nama_siswa.toUpperCase()}`, 45, startY);
  doc.setLineDashPattern([0.5, 0.5], 0);
  doc.line(45, startY + 1, 190, startY + 1);
  
  doc.text('Usia', 20, startY + lineGap);
  doc.text(`:  -`, 45, startY + lineGap); 
  doc.line(45, startY + lineGap + 1, 190, startY + lineGap + 1);

  doc.text('Kelas', 20, startY + lineGap * 2);
  doc.text(`:  ${permit.kelas}`, 45, startY + lineGap * 2);
  doc.line(45, startY + lineGap * 2 + 1, 190, startY + lineGap * 2 + 1);

  doc.text('Catatan Wali Asuh', 20, startY + lineGap * 3);
  doc.text(`:  ${permit.catatan_kamar || '-'}`, 55, startY + lineGap * 3);
  doc.line(55, startY + lineGap * 3 + 1, 190, startY + lineGap * 3 + 1);

  // Body
  doc.setLineDashPattern([], 0);
  const bodyText1 = `Berdasarkan hasil pemeriksaan di Unit Pelayanan Kesehatan Sekolah, yang bersangkutan dalam kondisi ${permit.diagnosa.toUpperCase()} dan memerlukan istirahat selama .....${permit.jumlah_hari}..... ( ..${terbilang(permit.jumlah_hari)}.. ) hari terhitung mulai tanggal ${format(permit.tgl_mulai.toDate(), 'dd MMMM yyyy')} s.d. tanggal ${format(permit.tgl_selesai.toDate(), 'dd MMMM yyyy')}.`;
  doc.text(bodyText1, 20, 155, { maxWidth: 170, align: 'justify' });

  doc.text('Demikian surat keterangan ini dibuat untuk dapat dipergunakan sebagaimana mestinya.', 20, 175);

  // Signature
  const footerY = 195;
  
  // QR Code for Wali Asuh
  const qrWaliAsuh = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=VERIFIED_WALI_ASUH_${permit.id}_${permit.nama_wali_asuh}`;
  doc.addImage(qrWaliAsuh, 'PNG', 52, footerY + 8, 15, 15);

  // QR Code for Perawat
  const qrDokter = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=VERIFIED_PERAWAT_${permit.id}_${permit.nama_dokter}`;
  doc.addImage(qrDokter, 'PNG', 142, footerY + 8, 15, 15);

  // Left Signature (Wali Asuh)
  doc.setFont('helvetica', 'normal');
  doc.text('Mengetahui,', 60, footerY, { align: 'center' });
  doc.text('Wali Asuh', 60, footerY + 5, { align: 'center' });
  doc.line(40, footerY + 25, 80, footerY + 25);
  doc.setFont('helvetica', 'bold');
  doc.text(permit.nama_wali_asuh || '-', 60, footerY + 30, { align: 'center' });
  
  // Right Signature (Perawat)
  doc.setFont('helvetica', 'normal');
  doc.text(`Kediri, ${format(permit.tgl_surat.toDate(), 'dd MMMM yyyy')}`, 150, footerY, { align: 'center' });
  doc.text('Perawat Pemeriksa,', 150, footerY + 5, { align: 'center' });
  doc.line(130, footerY + 25, 175, footerY + 25);
  doc.setFont('helvetica', 'bold');
  doc.text(permit.nama_dokter, 150, footerY + 30, { align: 'center' });

  // Digital Signature Note
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('File ini sudah ditandatangani secara digital', 105, footerY + 40, { align: 'center' });

  // Footer small text
  doc.setFontSize(7);
  doc.setFont('helvetica', 'italic');
  doc.text(`Keterangan ini dibuat dan di arsipkan oleh UKS SRMA 24 Kediri — ${format(permit.tgl_surat.toDate(), 'dd MMMM yyyy')}`, 20, 275);

  doc.save(`Surat_Sakit_${permit.nama_siswa.replace(/\s+/g, '_')}.pdf`);
};
