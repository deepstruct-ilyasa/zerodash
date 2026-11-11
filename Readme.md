# ZeroDash: Dasbor Manajemen MikroTik ZeroTier Controller

**ZeroDash** adalah dasbor manajemen berbasis web yang modern dan canggih, dirancang khusus untuk router MikroTik yang menjalankan layanan ZeroTier Controller dan Traffic Flow (IPFIX/NetFlow). Dibangun dengan antarmuka bertema *Winbox* yang elegan (mendukung mode gelap/terang) menggunakan **Tailwind CSS** dan **Alpine.js**, ZeroDash memberikan kemudahan bagi administrator jaringan untuk mengelola jaringan virtual (*software-defined network*) serta telemetri lalu lintas tanpa harus repot mengetik perintah terminal yang rumit.

---

## 🚀 Fitur & Kemampuan Utama

### 1. Konfigurasi Master Controller MikroTik
* **Manajemen Kredensial Router:** Menyimpan dan menghubungkan aplikasi ke router MikroTik secara aman menggunakan protokol API, API-SSL, HTTP, atau HTTPS.
* **Traffic Flow (Gaya Winbox):**
  * **Pengaturan Umum (General):** Mengaktifkan/menonaktifkan status Traffic Flow dengan indikator warna dinamis (Hijau/Merah), mengatur *timeout* aktif & tidak aktif, konfigurasi *cache entries*, *packet sampling*, serta pemilihan antarmuka router (`-- All Interfaces --` atau port spesifik).
  * **Daftar Target (Targets List):** Menambah, mengedit, dan menghapus beberapa target kolektor IPFIX/NetFlow sekaligus.
  * **Editor Target Lanjutan:** Mengatur alamat sumber, IP server tujuan, port, versi (v5 atau v9/IPFIX), interval *template refresh*, hingga konversi otomatis durasi *template timeout*.

### 2. Instance & Jaringan ZeroTier Controller
* **Manajemen Instance:** Mengonfigurasi *instance* software ZeroTier langsung di router MikroTik (pengaturan port, *route distance*, dan *binding interface*).
* **Manajemen Jaringan Controller:** Membuat, mengedit, dan menghapus jaringan virtual. Mengatur ukuran MTU, rentang IP (*ip-range*), status privat/publik, serta status aktif/nonaktif.
* **Utilitas Jaringan:**
  * **Pembuatan QR Code:** Menghasilkan QR Code Network ID berbingkai rapi yang siap diunduh langsung untuk memudahkan perangkat lain bergabung.
  * **Salin ke Clipboard (Satu Klik):** Menyalin Network ID dengan aman disertai umpan balik visual (*toast* / perubahan ikon centang).

### 3. Manajemen Member & Routing
* **Otorisasi & Kontrol Member:** Memantau perangkat yang terhubung, menetapkan atau mengubah Virtual IP, melacak ZT-Address, serta mengubah status otorisasi (`AUTHORIZED` vs `DENIED`) secara instan.
* **Filter Dropdown Multi-Controller:** Menyaring data *member* dan *route* berdasarkan jaringan controller tertentu atau menampilkannya secara bersamaan (*Semua Controller*).
* **Pengelola Tabel Routing:** Menambah, memodifikasi, atau menghapus *subnet* dan *gateway* kustom yang terhubung ke controller ZeroTier tertentu.

---

## 🛠️ Teknologi yang Digunakan

* **Backend:** Node.js, Express.js (berkomunikasi dengan MikroTik RouterOS menggunakan RouterOS API).
* **Frontend:** EJS (Embedded JavaScript templates), Tailwind CSS untuk styling, Lucide Icons, dan **Alpine.js** untuk manajemen *state* reaktif di sisi klien.

---

## 📦 Panduan Instalasi & Pengaturan (Dari Cloning hingga Production)

Ikuti langkah-langkah berikut untuk mengatur dan menjalankan ZeroDash di server atau komputer lokal Anda:

### Langkah 1: Clone Repository
Buka terminal Anda dan *clone* project dari GitHub:
```bash
git clone https://github.com/deepstruct-ilyasa/zerodash.git
cd zerodash
```

### Langkah 2: Instal Dependensi
Pastikan Anda sudah menginstal **Node.js** di server atau komputer Anda, kemudian jalankan perintah untuk menginstal paket yang dibutuhkan:
```bash
npm install
```

### Langkah 3: Konfigurasi Environment Variables
Buat file `.env` di direktori utama project untuk mendefinisikan konfigurasi aplikasi (seperti port server):
```bash
cp .env.example .env
```
Edit file `.env` menggunakan teks editor pilihan Anda (misalnya `nano .env` atau `vim .env`) sesuai dengan lingkungan server Anda.

### Langkah 4: Menjalankan Aplikasi
Anda dapat menjalankan aplikasi dalam mode pengembangan (*development*) atau mode produksi (*production*):
* **Mode Pengembangan (dengan auto-reload):**
  ```bash
  npm run dev
  ```
* **Mode Produksi (menggunakan PM2 atau Node langsung):**
  ```bash
  npm start
  ```

Setelah berjalan, buka browser Anda dan akses melalui alamat `http://<ip-server-anda>:<port>`.

---

## 📖 Panduan Pengguna & Navigasi Menu

### 1. Halaman Utama & Akses Admin
Saat pertama kali masuk, Anda akan disambut oleh antarmuka dasbor utama. Pastikan akun Anda memiliki hak akses sebagai admin (`window.USER_ROLE === 'admin'`) untuk melakukan perubahan seperti mengotorisasi member atau menyimpan kredensial router.

### 2. Mengonfigurasi Router & Traffic Flow
1. Masuk ke menu **Settings / Konfigurasi**.
2. Masukkan alamat IP router MikroTik, username, password, protokol, dan port. Klik **Simpan Kredensial**.
3. Pada bagian **Traffic Flow**, atur aturan telemetri Anda dan pastikan tombol toggle **Enabled** berubah menjadi hijau.
4. Pindah ke tab **Targets** untuk menambah atau mengedit tujuan kolektor *NetFlow* Anda.

### 3. Mengelola ZeroTier Controller & Jaringan
1. Buka menu **ZeroTier Controller**.
2. Kelola *instance* router Anda dan buat jaringan virtual baru dengan menentukan rentang IP (contoh: `10.10.10.1-10.10.10.30`).
3. Gunakan fitur **QR Code** untuk membagikan informasi jaringan atau gunakan tombol salin untuk mengambil Network ID.

### 4. Mengontrol Member & Routing
1. Buka tab **Members** untuk melihat seluruh perangkat yang terhubung (Windows, iOS, macOS, Linux, dan Router).
2. Gunakan **Dropdown Filter Controller** di pojok kanan atas tabel untuk memilah member berdasarkan jaringan controller tertentu.
3. Gunakan tombol aksi untuk mengotorisasi/mencabut akses node, mengedit IP virtual, atau menghapus perangkat.
4. Pindah ke tab **Routes** untuk mengelola jalur komunikasi antar jaringan virtual.

---

## 🤝 Kontribusi
Kontribusi, laporan bug, dan permintaan fitur sangat dipersilakan! Jangan ragu untuk membuka *pull request* atau melaporkan kendala pada halaman repository.

## 📄 Lisensi
Project ini bersifat sumber terbuka (*open-source*) dan berada di bawah lisensi [MIT License](LICENSE).