# TimberCraft Setup & Customization Guide

## Quick Start

1. **Download/Copy all files** to your server or local directory
2. **Add images** to the `img/` folder (see image requirements below)
3. **Update company info** in `index.html`
4. **Test responsiveness** on mobile devices
5. **Deploy** to your web host

---

## 🖼️ Image Requirements & Setup

### Required Images (12 total)

#### CHAIRS (4 images)
```
img/chair1.jpg    - Traditional African Chair (showcase traditional patterns)
img/chair2.jpg    - Modern Comfort Chair (contemporary with African touches)
img/chair3.jpg    - Ceremonial Chair Set (elegant with intricate carvings)
img/chair4.jpg    - Executive Office Chair (premium wooden for offices)
```

#### ROOFING (4 images)
```
img/roof1.jpg     - Traditional Thatched Roof (authentic African thatch)
img/roof2.jpg     - Wooden Beam Roof Structure (strong architectural design)
img/roof3.jpg     - Modern African Roofing (hybrid tradition + modern)
img/roof4.jpg     - Village Compound Roof (large-scale compound structures)
```

#### FURNITURE (4 images)
```
img/furniture1.jpg - African Dining Set (complete wooden dining furniture)
img/furniture2.jpg - Artisan Coffee Table (decorative with traditional carvings)
img/furniture3.jpg - Wooden Bedroom Suite (complete bedroom furniture)
img/furniture4.jpg - Traditional Storage Cabinet (decorative wooden doors)
```

#### ADDITIONAL IMAGES (1)
```
img/about-image.jpg - Workshop/Team photo for About section
```

### Image Specifications

- **Format**: JPG or PNG
- **Dimensions**: 500x500px minimum (square for portfolio items)
- **File Size**: Under 200KB for optimal loading
- **Quality**: High resolution for professional look
- **Aspect Ratio**: Square (1:1) for portfolio items works best

### How to Add Images

1. Save images in the `img/` folder with exact filenames listed above
2. Images will automatically display in portfolio section
3. Hover effects and descriptions are already configured

---

## ✏️ Customization Guide

### 1. Update Company Information

**Location**: Find in `index.html`

```html
<!-- Phone Number -->
<p>+256 700 123 456</p>  <!-- Change to your number -->

<!-- Email -->
<p>info@timbercraft.com</p>  <!-- Change to your email -->

<!-- Address -->
<p>123 Timber Lane, Kampala, Uganda</p>  <!-- Change to your address -->

<!-- Business Hours -->
<p>Mon - Fri: 8:00 AM - 6:00 PM<br>Sat: 9:00 AM - 4:00 PM</p>
```

### 2. Update Portfolio Item Descriptions

In `index.html`, find portfolio items and modify titles/descriptions:

```html
<div class="portfolio-item chairs" data-category="chairs">
    <img src="img/chair1.jpg" alt="Traditional African Chair">
    <div class="portfolio-info">
        <h4>Traditional African Chair</h4>  <!-- Change title -->
        <p>Hand-carved wooden chair with traditional patterns</p>  <!-- Change description -->
    </div>
</div>
```

### 3. Update About Section Statistics

```html
<div class="stat">
    <h3>500+</h3>  <!-- Change number -->
    <p>Projects Completed</p>  <!-- Change label -->
</div>
```

### 4. Change Color Scheme

**Location**: `css/style.css` (top of file)

```css
:root {
    --primary-color: #b8860b;      /* Main gold color */
    --secondary-color: #8b6f47;    /* Hover/accent brown */
    --dark-color: #1a1410;         /* Dark backgrounds */
    --light-color: #f8f5f0;        /* Light backgrounds */
    --accent-color: #d4a574;       /* Button accents */
}
```

**Color Suggestions for African Theme**:
```
Warm Gold: #d4a574
Deep Brown: #8b4513
Burnt Orange: #cc5500
Earth Tone: #704020
Rich Red: #8b3a3a
```

### 5. Update Navigation Links

All navigation is automatic - just update section content.

### 6. Customize Hero Section

**Location**: `index.html` - Hero section

```html
<h1 class="hero-title">Masterful Woodwork<span class="highlight">.</span></h1>
<p class="hero-subtitle">Timeless Designs from African Heritage</p>
<p class="hero-description">Expert carpentry, custom chairs, stunning roofing, and bespoke furniture crafted with passion</p>
```

### 7. Update Testimonials

```html
<p class="testimonial-text">"Your testimonial here..."</p>
<p class="testimonial-author">- Client Name</p>
```

---

## 🔧 Technical Customizations

### Change Website Title & Meta Tags

In `index.html` head section:

```html
<title>Your Company Name - Services Description</title>
<meta name="description" content="Your company description">
<meta name="keywords" content="carpentry, chairs, roofing, african design">
```

### Update Social Media Links

In footer, find social links section:

```html
<a href="https://facebook.com/yourpage"><i class="fab fa-facebook"></i></a>
<a href="https://instagram.com/yourpage"><i class="fab fa-instagram"></i></a>
```

### Add Google Analytics

Add this before closing `</body>` tag in `index.html`:

```html
<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'GA_ID');
</script>
```

---

## 📱 Testing Checklist

- [ ] Test on mobile (iPhone, Android)
- [ ] Test on tablet (iPad)
- [ ] Test on desktop (different screen sizes)
- [ ] Verify all links work
- [ ] Test contact form
- [ ] Test portfolio filtering
- [ ] Check image loading
- [ ] Verify responsive menu
- [ ] Test form validation
- [ ] Check colors match branding

---

## 🚀 Deployment Steps

### For Local Testing
1. Save all files in a folder
2. Open `index.html` in your browser
3. Test all functionality

### For Web Server
1. FTP/Upload all files to web server
2. Maintain folder structure (css/, js/, img/)
3. Update file paths if necessary
4. Test on live domain

### Popular Hosting Options
- **Shared Hosting**: Bluehost, Hostinger
- **VPS**: DigitalOcean, Linode
- **Static Hosting**: Netlify, Vercel, GitHub Pages
- **Domain Registrar**: GoDaddy, Namecheap

---

## 🆘 Troubleshooting

### Images Not Displaying
- Check image filenames match exactly
- Verify images are in `img/` folder
- Check image file extensions (.jpg vs .jpeg)
- Ensure images are not corrupted

### Styles Not Loading
- Clear browser cache (Ctrl+F5 or Cmd+Shift+R)
- Check CSS file path in HTML is correct
- Verify `css/style.css` file exists
- Check for console errors in DevTools

### Forms Not Working
- JavaScript is required - ensure it's not disabled
- Check browser console for errors
- Verify form names match in HTML and JS
- For email submission, need backend service

### Mobile Menu Not Working
- Check hamburger icon is visible on mobile
- Verify JavaScript file is loaded
- Clear cache and reload
- Test in different browser

---

## 📊 Performance Tips

1. **Optimize Images**
   - Use tools like TinyPNG or ImageOptim
   - Compress images before uploading
   - Use WebP format for smaller file sizes

2. **Enable Caching**
   - Ask hosting provider to enable caching
   - Reduces load times for repeat visitors

3. **Minify Code**
   - Use online minifiers for CSS/JS in production
   - Reduces file sizes significantly

4. **Lazy Load Images**
   - JavaScript code supports data-src attribute
   - Images load as user scrolls

5. **CDN Usage**
   - Consider using CDN for faster global delivery
   - Services like Cloudflare offer free CDN

---

## 🎓 File Descriptions

| File | Purpose |
|------|---------|
| `index.html` | Main page structure and content |
| `css/style.css` | All custom styling and layouts |
| `css/normalize.css` | CSS reset for consistency |
| `css/reset.css` | Additional CSS resets |
| `js/main.js` | All interactive functionality |
| `README.md` | Project overview and features |
| `SETUP_GUIDE.md` | This customization guide |

---

## ✅ Final Checklist

- [ ] All images uploaded to `img/` folder
- [ ] Company contact info updated
- [ ] Portfolio titles and descriptions customized
- [ ] Colors match your branding
- [ ] Social media links added
- [ ] Website tested on mobile/tablet/desktop
- [ ] Forms tested and working
- [ ] Portfolio filtering tested
- [ ] All links and navigation working
- [ ] Deployed to web server
- [ ] Domain configured
- [ ] Analytics added

---

## 💡 Pro Tips

1. **Keep consistent branding** - Use same colors and fonts across all pages
2. **Regular updates** - Add new projects to portfolio regularly
3. **Optimize for SEO** - Update meta tags and descriptions
4. **Mobile first** - Always test mobile experience first
5. **Fast loading** - Optimize images for faster load times
6. **Backup files** - Keep copies of original files
7. **Monitor analytics** - Track visitor behavior
8. **Respond to inquiries** - Reply to contact form quickly

---

## 🎨 Design Notes

- **Color Psychology**: Golds and browns evoke quality, tradition, and craftsmanship
- **Typography**: Playfair Display for elegance, Inter for readability
- **Spacing**: Generous whitespace conveys luxury
- **Images**: High-quality photos are essential for portfolio sites
- **Animations**: Subtle effects enhance without overwhelming

---

Enjoy your captivating carpentry website! 🔨✨

For support, contact your hosting provider or web developer.
