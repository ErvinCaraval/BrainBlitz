#!/bin/bash

# Simplified build script for Render deployment
echo "🚀 Building React app for Render deployment..."

# Clean previous build
echo "🧹 Cleaning previous build..."
rm -rf dist

# Build the app
echo "🔨 Building React application..."
npm run build

# Verify build was successful
if [ ! -f "dist/index.html" ]; then
    echo "❌ Build failed - index.html not found!"
    exit 1
fi

# Copy only the essential _redirects file (fallback)
echo "📁 Copying _redirects file (fallback)..."
cp public/_redirects dist/_redirects
echo "✅ Copied _redirects (fallback method)"

# Verify files exist
echo "🔍 Verifying build files:"
ls -la dist/ | grep -E "(_redirects|index.html)"

echo ""
echo "🎉 Build completed successfully!"
echo "📦 Ready for deployment to Render"
echo "💡 SPA routing is configured via Render dashboard"
