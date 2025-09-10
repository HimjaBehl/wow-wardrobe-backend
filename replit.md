# Fashion Outfit Generation and Styling Service

## Overview

This is a fashion-focused backend service that combines wardrobe management, AI-powered outfit generation, and fashion trend insights. The system analyzes user wardrobes, generates styled outfit recommendations using LLM agents, and incorporates real-time fashion trends from external sources like Pinterest and Vogue. It includes sophisticated fashion rules for color harmony, silhouette balance, and seasonal appropriateness.

The service is built around "Tina," an AI stylist agent that creates personalized outfit recommendations based on user preferences, wardrobe items, weather conditions, and current fashion trends.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Backend Framework
- **Express.js** server with CORS enabled for cross-origin requests
- **ES6 modules** (`"type": "module"` in package.json) for modern JavaScript syntax
- **Environment-based configuration** using dotenv for API keys and service credentials

### AI and Language Models
- **LangChain integration** with OpenAI GPT-3.5-turbo for outfit generation and reasoning
- **OpenAI Embeddings** (text-embedding-3-small) for fashion trend similarity search
- **Tina Agent** - Custom AI stylist that generates 2-3 complete outfit recommendations using wardrobe items and trend context
- **Python trend analysis tool** integrated via child process execution for specialized fashion insights

### Data Storage Solutions
- **Firebase Firestore** for user data, wardrobe items, and outfit feedback storage
- **Firebase Storage** for image uploads with signed URL generation (1-year expiry)
- **Supabase** with vector search capabilities for fashion trend embeddings and similarity matching
- **Fashion taxonomy JSON** for structured clothing categorization and attribute mapping

### Image Processing and Analysis
- **Sharp** library for image cropping, resizing, and format conversion to PNG
- **Ximilar API** integration for automated fashion item tagging and categorization
- **Bounding box cropping** system for extracting specific clothing items from images
- **UUID-based file naming** for unique image storage in Firebase

### Fashion Intelligence System
- **Color harmony rules** including complementary, monochrome, analogous, and triadic color schemes
- **Silhouette analysis** with role-based categorization (anchor, upper, lower, outer, accessory)
- **Seasonal fabric matching** against weather conditions
- **Style validation rules** for outfit completeness and banned item filtering
- **Fashion taxonomy system** with hierarchical categorization and attribute mapping

### Trend Analysis and Insights
- **Vector similarity search** using OpenAI embeddings to match user queries with fashion trend database
- **Multi-source trend integration** from Pinterest, Vogue, and Fashion Week data
- **Theme-based trend fetching** with fallback to curated mock trends
- **Real-time trend insight tool** implemented in Python with LangChain integration

### User Personalization
- **Dislike tracking system** that learns from user feedback to avoid specific items, colors, or styles
- **Weather-aware recommendations** using OpenWeather API integration
- **Location-based styling** with city-specific weather data
- **Theme-based outfit generation** (Casual, Party, Workwear, Athleisure, Brunch, Dinner)

### Validation and Rules Engine
- **Multi-layer outfit validation** checking category balance, color harmony, and silhouette compatibility
- **User preference enforcement** with banned items and style restrictions
- **Seasonal appropriateness checks** matching fabric types to weather conditions
- **Completeness validation** ensuring outfits include essential components (top/bottom or dress + footwear)

## External Dependencies

### AI and Machine Learning Services
- **OpenAI API** - GPT-3.5-turbo for outfit generation and text-embedding-3-small for trend similarity
- **Ximilar Fashion API** - Automated clothing item detection, tagging, and categorization
- **LangChain** - Framework for building AI agent workflows and tool integration

### Cloud Storage and Database
- **Firebase Admin SDK** - Firestore for document storage and Firebase Storage for image hosting
- **Supabase** - PostgreSQL with vector search extensions for fashion trend embeddings
- **Google Cloud Storage** - Underlying storage for Firebase with signed URL generation

### Weather and Location Services
- **OpenWeather API** - Real-time weather data for location-based outfit recommendations

### Image Processing
- **Sharp** - High-performance image processing for cropping and format conversion
- **tmp-promise** - Temporary file handling for image processing workflows

### Development and Utilities
- **Express.js** - Web framework with CORS support
- **UUID** - Unique identifier generation for files and database records
- **Axios** - HTTP client for external API requests
- **Multer** - Multipart form data handling for file uploads
- **dotenv** - Environment variable management for API keys and configuration