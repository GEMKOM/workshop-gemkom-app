# GEMKOM - Endüstriyel Yönetim Sistemi

Modern, mobil uyumlu endüstriyel yönetim sistemi. Blue collar kullanıcılar için optimize edilmiş arayüz.

## 🚀 Özellikler

- **Modern Tasarım**: Güncel UI/UX prensipleri ile tasarlanmış arayüz
- **Mobil Uyumlu**: Özellikle mobil cihazlarda mükemmel çalışır
- **Takım Bazlı Çalışma**: Her takım kendi modülünde çalışır
- **Otomatik Yönlendirme**: Kullanıcı takımına göre otomatik yönlendirme
- **Güvenli Kimlik Doğrulama**: JWT tabanlı güvenli sistem
- **Gerçek Zamanlı**: Veriler gerçek zamanlı olarak güncellenir

## 📱 Modüller

### 🏭 Talaşlı İmalat
- Makine görevlerini yönetin
- Zamanlayıcıları kullanın
- Üretim süreçlerini takip edin

### 🔧 Bakım
- Bakım taleplerini yönetin
- Planlı bakımları takip edin
- Ekipman durumlarını izleyin

### 👨‍💼 Yönetim Paneli (Admin)
- Kullanıcı yönetimi
- Sistem ayarları
- Sistem raporları

## 🎨 Tasarım Sistemi

### Renk Paleti
- **Primary**: #8B0000 (Koyu Kırmızı)
- **Secondary**: #b40024 (Orta Kırmızı)
- **Accent**: #FF4D4D (Parlak Kırmızı)
- **Text**: #2c3e50 (Koyu Gri)
- **Light BG**: #f8f9fa (Açık Gri)

### Tipografi
- **Font**: Segoe UI, system-ui, -apple-system, sans-serif
- **Başlıklar**: Bold (700)
- **Normal Metin**: Regular (400)
- **Vurgu**: Medium (500)

### Bileşenler
- **Kartlar**: Yuvarlatılmış köşeler, gölge efektleri
- **Butonlar**: Gradient arka plan, hover animasyonları
- **Navigasyon**: Modern dropdown menüler
- **Formlar**: Mobil uyumlu input alanları

## 📱 Mobil Optimizasyon

- **Touch Targets**: Minimum 44px dokunma alanları
- **Responsive Design**: Tüm ekran boyutlarında uyumlu
- **Gesture Support**: Mobil hareket desteği
- **Performance**: Hızlı yükleme süreleri

## 🔧 Teknik Detaylar

### Kullanılan Teknolojiler
- **Frontend**: Vanilla JavaScript (ES6+)
- **CSS**: Modern CSS3 (Grid, Flexbox, Custom Properties)
- **UI Framework**: Bootstrap 5
- **Icons**: Font Awesome 6
- **Authentication**: JWT Tokens

### Dosya Yapısı
```
blue-app/
├── index.html              # Ana sayfa (Landing)
├── main.js                 # Ana JavaScript dosyası
├── style.css               # Global stiller
├── authService.js          # Kimlik doğrulama servisi
├── base.js                 # API endpoint'leri
├── components/             # Yeniden kullanılabilir bileşenler
├── machining/              # Talaşlı İmalat modülü
├── maintenance/            # Bakım modülü
├── admin/                  # Yönetim paneli
├── login/                  # Giriş sayfaları
└── images/                 # Görseller
```

## 🚀 Kurulum

1. Projeyi klonlayın
2. Web sunucusu ile çalıştırın (localhost)
3. Tarayıcıda açın

## 🔐 Güvenlik

- JWT token tabanlı kimlik doğrulama
- Güvenli API çağrıları
- XSS koruması
- CSRF koruması

## 📊 Performans

- **Lazy Loading**: Gerektiğinde yükleme
- **Caching**: Akıllı önbellekleme
- **Minification**: Sıkıştırılmış dosyalar
- **CDN**: Hızlı kaynak yükleme

## 🎯 Gelecek Planları

- [ ] PWA desteği
- [ ] Offline çalışma
- [ ] Push notifications
- [ ] Gelişmiş raporlama
- [ ] Çoklu dil desteği
- [ ] Dark mode

## 🤝 Katkıda Bulunma

1. Fork yapın
2. Feature branch oluşturun
3. Değişikliklerinizi commit edin
4. Pull request gönderin

## 📄 Lisans

Bu proje GEMKOM şirketi için özel olarak geliştirilmiştir.

---

**GEMKOM** - Endüstriyel süreçlerinizi dijitalleştiren modern çözümler 