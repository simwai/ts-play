# 🛸 TSPlay

<p align="center">
  <img src="banner.svg" alt="TSPlay Banner" width="800">
</p>

TSPlay is a high-performance, mobile-responsive TypeScript playground that brings a complete Node.js environment directly to the browser. Powered by [WebContainers](https://webcontainers.io/), it allows for real-time compilation, execution, and dependency management without any backend infrastructure.

## Key Features

- **Full Node.js Runtime**: Execute code in a genuine browser-based environment.
- **Monaco Editor Integration**: A professional editing experience optimized for both desktop and mobile.
- **Automatic Type Acquisition (ATA)**: Seamlessly fetch TypeScript definitions for any npm package upon import.
- **Intelligent Type Insights**: Access real-time type information at your cursor position.
- **Theming Suite**: Choose from curated themes like Catppuccin, GitHub, and Monokai, with automatic dark/light mode filtering.
- **Live tsconfig.json Control**: Modify compiler options on the fly with instant validation.
- **One-Click Sharing**: Generate compressed, shareable URLs to distribute your code snippets instantly.

## Getting Started

To run TSPlay locally:

1. **Clone the repository:**

   ```bash
   git clone https://github.com/simwai/ts-play.git
   cd ts-play
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Start the development nexus:**
   ```bash
   npm run d\ev
   ```

_Note: The development server includes pre-configured COOP/COEP headers required for WebContainers._

## Production Deployment

For production environments (e.g., Apache or Plesk), ensure the following security headers are set to enable `SharedArrayBuffer` support:

- `Cross-Origin-Embedder-Policy: require-corp`
- `Cross-Origin-Opener-Policy: same-origin`

### Plesk Configuration

Add the above headers under **Hosting Settings -> Additional headers**.

### Apache (.htaccess)

```apache
<IfModule mod_headers.c>
  Header set Cross-Origin-Embedder-Policy "require-corp"
  Header set Cross-Origin-Opener-Policy "same-origin"
</IfModule>
```

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository.
2. Create a feature branch (`git checkout -b feat/your-feature`).
3. Commit your changes (`git commit -m 'feat: description'`).
4. Push to the branch (`git push origin feat/your-feature`).
5. Open a Pull Request.

## License

TSPlay is open-source software licensed under the [MIT License](LICENSE).
