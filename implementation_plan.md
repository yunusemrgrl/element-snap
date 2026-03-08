# MVP Hedef Açıklaması

Kullanıcının ekranından aldığı resimlerin üzerine çeşitli çizim, işaretleme ve şekil eklemelerine (Ok, Metin, Dikdörtgen, Kırpma) izin veren ve sonucu PNG, JPG veya PDF olarak aktarmasını sağlayan çalışan bir v1 MVP (Minimum Viable Product) Chrome Eklentisi oluşturmak.

## Önerilen Değişiklikler

### Eklenti Dosyaları

- `manifest.json`
  - Manifest dosyasını v3 izinleriyle MVP hedefine uygun olacak şekilde hazırlama. (Permissions: `storage`, `downloads`, `unlimitedStorage`, `activeTab`, `scripting`).

- `editor.html`
  - Resim gösterimi ve çizim işlemleri için iki katmanlı `<canvas>` yapısı oluşturulacak. Ekranın üst ve alt kısımlarına toolbar eklenecek.
  - jsPDF kütüphanesi CDN üzerinden eklenecek.

- `editor.js`
  - Canvas 2D kullanılarak interaktif çizim araçları (Kalem, Dikdörtgen, Ok, Metin, Kırpma) kodlanacak.
  - Geri Alma (Undo) özelliği eklenecek (son 5-10 işlemi tutan bir history dizisiyle).
  - İndirme ve panoya kopyalama işlemleri `jsPDF` ve `navigator.clipboard` kullanılarak uygulanacak.
  - Zoom işlemleri eklenecek.
  - Chrome `storage.local` üzerinden `capturedImage` verisi okunup yüklenecek. Bilgisayardan da bağımsız dosya yüklemesi desteklenecek.

## Doğrulama Planı

### Manuel Doğrulama
- Chrome Eklentiler sayfasına (chrome://extensions) gidilerek `Load unpacked` seçeneğiyle klasör yüklenecek.
- Uygulama başlatıldığında `editor.html` sayfasının açılıp açılmadığı ve `storage` içindeki resmin gelip gelmediği kontrol edilecek (Eğer `storage` boşsa test için localden bir resim yüklenebilmeli).
- Kalem, Dikdörtgen, Ok, Metin, Crop araçları sırayla farenin tıklanıp sürüklenmesiyle denenecek.
- İşlemlerden sonra `Undo` butonuna basılarak adımların geri alındığı görülecek.
- Son olarak `Download (PNG/JPG/PDF)` butonlarına ve `Copy to Clipboard` butonuna basılarak çıktı dosyasının başarıyla dışarı aktarıldığı doğrulanacak.
