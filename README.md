# 🎲 Okey & 101 Okey - Çok Oyunculu Web Platformu (GitHub Pages & P2P)

Ofis arkadaşlarınızla veya uzaktaki dostlarınızla tarayıcı üzerinden tamamen ücretsiz, sıfır sunucu maliyetiyle **Klasik Düz Okey** ve **101 Yüzbir Okey** oynayabileceğiniz modern web oyunu.

---

## 🌟 Özellikler

- **%100 Ücretsiz & Sunucusuz (P2P WebRTC):** GitHub Pages üzerinde statik olarak çalışır. Sunucu kapanması, uyku modu veya fatura derdi yoktur.
- **Klasik Düz Okey:** 14/15 taş dağıtımı, seriler (11-12-13-1 dahil), perler, çiftler ve okeyle bitme.
- **101 Yüzbir Okey:** 21/22 taş dağıtımı, 101 puan barajı, 5 çift açma, masaya açık perlere **taş işleme** ve isteğe bağlı **Katlamalı mod**.
- **Yapay Zeka (Botlar):** 4 kişi tamamlanmadığında masadaki boş koltuklara tek tıkla Bot ekleyebilirsiniz.
- **Zengin Dokunsal Tasarım:** Lüks yeşil çuha masa dokusu, maun ahşap ıstaka, fildişi 3D taşlar ve Web Audio API ile sıfır gecikmeli gerçekçi seramik taş sesleri.
- **Oda Kodları:** 4 haneli kolay kodlar ile (örn: `4821`) dünyanın her yerinden anında aynı masaya katılma.
- **Oyun İçi Sohbet:** Mesajlaşma ve ofis emojileri (☕, 👏, 🔥, 🎲).

---

## 🚀 GitHub Pages ile Canlıya Alma (2 Dakikada)

Projenin içinde GitHub Pages için otomatik derleme ve yayınlama dosyası hazırdır (`.github/workflows/deploy.yml`).

### Adım 1: GitHub'da Yeni Bir Repo Oluşturun
1. [github.com](https://github.com) adresine gidin ve **New repository** butonuna tıklayın.
2. Repoya bir isim verin (Örn: `okey`).
3. **Public** seçeneğini işaretleyip **Create repository** butonuna tıklayın.

### Adım 2: Kodları GitHub'a Yükleyin
Eğer bilgisayarınızda Git kuruluysa terminalden şu 4 komutu çalıştırmanız yeterlidir:
```bash
git init
git add .
git commit -m "İlk sürüm: Okey & 101 Okey P2P"
git branch -M main
git remote add origin https://github.com/KULLANICI_ADINIZ/okey.git
git push -u origin main
```
*(Git kurulu değilse GitHub Desktop programını kullanabilir veya GitHub sayfasındaki "uploading an existing file" seçeneğiyle klasörü yükleyebilirsiniz).*

### Adım 3: GitHub Pages'i Aktifleştirin
1. GitHub reponuzda **Settings** > **Pages** sekmesine gidin.
2. **Build and deployment** > **Source** kısmından **GitHub Actions** seçeneğini seçin.
3. 1 dakika içinde oyununuz şu adreste canlıya çıkacaktır:
   `https://KULLANICI_ADINIZ.github.io/okey/`

---

## 💻 Yerel Olarak Çalıştırma (Test İçin)

```bash
# Bağımlılıkları yükleyin
npm install

# Geliştirme sunucusunu başlatın
npm run client
# veya
npm run dev
```
Tarayıcınızda `http://localhost:3000` adresini açın.
