'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingCart, Search, Tag, Gamepad2, ShieldCheck, Flame, 
  Sparkles, Filter, X, Home, ShoppingBag, User, 
  CheckCircle2, Play, Cpu, Package, Lock, Key, Check, 
  Award, Settings, LogOut, TrendingDown, TrendingUp, 
  BarChart3, DollarSign, Activity, AlertCircle, ArrowUpRight
} from 'lucide-react';

// ============================================================================
// 1. MODELO RELACIONAL DE PRODUCTOS Y DATOS MOCK COMPLETO (CON ANALÍTICAS DE PRECIO)
// ============================================================================

const MOCK_GAMES = [
  // --- GIFT CARDS ---
  {
    id: "g-steam-10",
    title: "Steam Gift Card $10 USD",
    slug: "steam-gift-card-10-usd",
    category: "Gift Cards",
    coverImage: "https://images.unsplash.com/photo-1612287230202-1ff1d85d1bdf?auto=format&fit=crop&q=80&w=600",
    description: "Recarga $10 en tu billetera de Steam para comprar juegos, contenidos y más.",
    tag: "POPULAR",
    priceHistory30d: { lowest: 10.20, highest: 11.50, isLowest30d: true },
    variants: [
      { id: "v-s10-glo", platform: "PC (Steam)", region: "Global", supplierCostUsd: 9.80, priceUsd: 10.99, stock: 45, g2aPriceUsd: 9.95, enebaPriceUsd: 9.80 }
    ]
  },
  {
    id: "g-steam-20",
    title: "Steam Gift Card $20 USD",
    slug: "steam-gift-card-20-usd",
    category: "Gift Cards",
    coverImage: "https://images.unsplash.com/photo-1612287230202-1ff1d85d1bdf?auto=format&fit=crop&q=80&w=600",
    bannerImage: "https://images.unsplash.com/photo-1612287230202-1ff1d85d1bdf?auto=format&fit=crop&q=80&w=1200",
    description: "Código digital de $20 USD para saldo directo en Steam.",
    featured: true,
    tag: "MÁS VENDIDO",
    priceHistory30d: { lowest: 20.50, highest: 23.00, isLowest30d: false },
    variants: [
      { id: "v-s20-glo", platform: "PC (Steam)", region: "Global", supplierCostUsd: 19.50, priceUsd: 21.50, stock: 120, g2aPriceUsd: 19.90, enebaPriceUsd: 19.50 }
    ]
  },
  {
    id: "g-steam-50",
    title: "Steam Gift Card $50 USD",
    slug: "steam-gift-card-50-usd",
    category: "Gift Cards",
    coverImage: "https://images.unsplash.com/photo-1612287230202-1ff1d85d1bdf?auto=format&fit=crop&q=80&w=600",
    description: "Añade $50 USD inmediatamente a tu monedero oficial de Steam.",
    priceHistory30d: { lowest: 51.00, highest: 55.00, isLowest30d: true },
    variants: [
      { id: "v-s50-glo", platform: "PC (Steam)", region: "Global", supplierCostUsd: 48.90, priceUsd: 52.99, stock: 30, g2aPriceUsd: 49.20, enebaPriceUsd: 48.90 }
    ]
  },
  {
    id: "g-psn-10",
    title: "PlayStation Network Card $10 USD",
    slug: "playstation-network-card-10-usd",
    category: "Gift Cards",
    coverImage: "https://images.unsplash.com/photo-1606813907291-d86efa9b94db?auto=format&fit=crop&q=80&w=600",
    description: "Tarjeta prepagada de $10 USD para cuentas PlayStation Store Estados Unidos.",
    priceHistory30d: { lowest: 9.99, highest: 11.20, isLowest30d: false },
    variants: [
      { id: "v-ps10-us", platform: "PlayStation 5", region: "US Store", supplierCostUsd: 9.20, priceUsd: 10.50, stock: 80, g2aPriceUsd: 9.50, enebaPriceUsd: 9.20 }
    ]
  },
  {
    id: "g-psn-25",
    title: "PlayStation Network Card $25 USD",
    slug: "playstation-network-card-25-usd",
    category: "Gift Cards",
    coverImage: "https://images.unsplash.com/photo-1606813907291-d86efa9b94db?auto=format&fit=crop&q=80&w=600",
    bannerImage: "https://images.unsplash.com/photo-1606813907291-d86efa9b94db?auto=format&fit=crop&q=80&w=1200",
    description: "Crédito de $25 USD para comprar juegos y add-ons en PlayStation Store US.",
    featured: true,
    tag: "OFERTA TOP",
    priceHistory30d: { lowest: 24.99, highest: 27.50, isLowest30d: true },
    variants: [
      { id: "v-ps25-us", platform: "PlayStation 5", region: "US Store", supplierCostUsd: 23.50, priceUsd: 25.99, stock: 65, g2aPriceUsd: 23.90, enebaPriceUsd: 23.50 }
    ]
  },
  {
    id: "g-psn-50",
    title: "PlayStation Network Card $50 USD",
    slug: "playstation-network-card-50-usd",
    category: "Gift Cards",
    coverImage: "https://images.unsplash.com/photo-1606813907291-d86efa9b94db?auto=format&fit=crop&q=80&w=600",
    description: "Gift Card de $50 USD para PlayStation 4 y PlayStation 5 en la eStore de EE.UU.",
    priceHistory30d: { lowest: 49.99, highest: 54.00, isLowest30d: false },
    variants: [
      { id: "v-ps50-us", platform: "PlayStation 5", region: "US Store", supplierCostUsd: 46.80, priceUsd: 51.50, stock: 40, g2aPriceUsd: 47.10, enebaPriceUsd: 46.80 }
    ]
  },
  {
    id: "g-nin-10",
    title: "Nintendo eShop Card $10 USD",
    slug: "nintendo-eshop-card-10-usd",
    category: "Gift Cards",
    coverImage: "https://images.unsplash.com/photo-1578303512597-81e6cc155b3e?auto=format&fit=crop&q=80&w=600",
    description: "Añade saldo eShop a tu Nintendo Switch para comprar juegos indies y expansiones.",
    priceHistory30d: { lowest: 10.50, highest: 11.80, isLowest30d: true },
    variants: [
      { id: "v-n10-us", platform: "Nintendo Switch", region: "US Store", supplierCostUsd: 9.30, priceUsd: 10.75, stock: 25, g2aPriceUsd: 9.60, enebaPriceUsd: 9.30 }
    ]
  },
  {
    id: "g-nin-20",
    title: "Nintendo eShop Card $20 USD",
    slug: "nintendo-eshop-card-20-usd",
    category: "Gift Cards",
    coverImage: "https://images.unsplash.com/photo-1578303512597-81e6cc155b3e?auto=format&fit=crop&q=80&w=600",
    description: "Saldo digital de $20 USD para la eShop oficial de Nintendo.",
    priceHistory30d: { lowest: 20.00, highest: 22.50, isLowest30d: false },
    variants: [
      { id: "v-n20-us", platform: "Nintendo Switch", region: "US Store", supplierCostUsd: 18.90, priceUsd: 21.00, stock: 35, g2aPriceUsd: 19.10, enebaPriceUsd: 18.90 }
    ]
  },
  {
    id: "g-nin-50",
    title: "Nintendo eShop Card $50 USD",
    slug: "nintendo-eshop-card-50-usd",
    category: "Gift Cards",
    coverImage: "https://images.unsplash.com/photo-1578303512597-81e6cc155b3e?auto=format&fit=crop&q=80&w=600",
    description: "Gift Card de $50 USD para descargas directas en tu Nintendo Switch.",
    priceHistory30d: { lowest: 50.50, highest: 56.00, isLowest30d: true },
    variants: [
      { id: "v-n50-us", platform: "Nintendo Switch", region: "US Store", supplierCostUsd: 47.00, priceUsd: 52.00, stock: 15, g2aPriceUsd: 47.80, enebaPriceUsd: 47.00 }
    ]
  },
  {
    id: "g-xbox-20",
    title: "Xbox Gift Card $20 USD",
    slug: "xbox-gift-card-20-usd",
    category: "Gift Cards",
    coverImage: "https://images.unsplash.com/photo-1621259182978-fbf93132d53d?auto=format&fit=crop&q=80&w=600",
    description: "Válida para consolas Xbox One, Xbox Series X/S y tienda Windows PC.",
    priceHistory30d: { lowest: 19.99, highest: 22.00, isLowest30d: false },
    variants: [
      { id: "v-x20-us", platform: "Multiplataforma", region: "US Store", supplierCostUsd: 18.80, priceUsd: 20.99, stock: 30, g2aPriceUsd: 19.00, enebaPriceUsd: 18.80 }
    ]
  },
  {
    id: "g-apple-15",
    title: "Apple Gift Card $15 USD",
    slug: "apple-gift-card-15-usd",
    category: "Gift Cards",
    coverImage: "https://images.unsplash.com/photo-1563203369-26f2e4a5ccf7?auto=format&fit=crop&q=80&w=600",
    description: "Canjeable en la App Store para compras de juegos en iOS e iCloud.",
    priceHistory30d: { lowest: 15.20, highest: 17.50, isLowest30d: false },
    variants: [
      { id: "v-ap15-us", platform: "Multiplataforma", region: "US Store", supplierCostUsd: 14.10, priceUsd: 15.99, stock: 50, g2aPriceUsd: 14.50, enebaPriceUsd: 14.10 }
    ]
  },
  {
    id: "g-google-10",
    title: "Google Play Gift Card $10 USD",
    slug: "google-play-gift-card-10-usd",
    category: "Gift Cards",
    coverImage: "https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&q=80&w=600",
    description: "Recarga tu saldo de Google Play Store para juegos y apps en Android.",
    priceHistory30d: { lowest: 10.20, highest: 11.90, isLowest30d: true },
    variants: [
      { id: "v-gp10-us", platform: "Multiplataforma", region: "US Store", supplierCostUsd: 9.30, priceUsd: 10.99, stock: 40, g2aPriceUsd: 9.50, enebaPriceUsd: 9.30 }
    ]
  },

  // --- MONEDAS Y PASES ---
  {
    id: "m-fortnite-1000",
    title: "Fortnite - 1,000 PaVos (V-Bucks)",
    slug: "fortnite-1000-v-bucks",
    category: "Monedas",
    coverImage: "https://images.unsplash.com/photo-1589241062272-c0a000072dfa?auto=format&fit=crop&q=80&w=600",
    description: "Código de 1,000 Pavos para comprar skins, gestos y el Pase de Batalla.",
    tag: "POPULAR",
    priceHistory30d: { lowest: 8.99, highest: 10.50, isLowest30d: true },
    variants: [
      { id: "v-fn1000-glo", platform: "Multiplataforma", region: "Global", supplierCostUsd: 7.90, priceUsd: 9.50, stock: 150, g2aPriceUsd: 8.10, enebaPriceUsd: 7.90 }
    ]
  },
  {
    id: "m-fortnite-2800",
    title: "Fortnite - 2,800 PaVos (V-Bucks)",
    slug: "fortnite-2800-v-bucks",
    category: "Monedas",
    coverImage: "https://images.unsplash.com/photo-1589241062272-c0a000072dfa?auto=format&fit=crop&q=80&w=600",
    description: "Paquete de 2,800 Pavos con ahorro adicional para la tienda de Fortnite.",
    priceHistory30d: { lowest: 21.99, highest: 24.50, isLowest30d: false },
    variants: [
      { id: "v-fn2800-glo", platform: "Multiplataforma", region: "Global", supplierCostUsd: 19.80, priceUsd: 22.99, stock: 85, g2aPriceUsd: 20.20, enebaPriceUsd: 19.80 }
    ]
  },
  {
    id: "m-fortnite-5000",
    title: "Fortnite - 5,000 PaVos (V-Bucks)",
    slug: "fortnite-5000-v-bucks",
    category: "Monedas",
    coverImage: "https://images.unsplash.com/photo-1589241062272-c0a000072dfa?auto=format&fit=crop&q=80&w=600",
    description: "Paquete masivo de 5,000 PaVos activable en Epic Games.",
    priceHistory30d: { lowest: 34.00, highest: 38.00, isLowest30d: true },
    variants: [
      { id: "v-fn5000-glo", platform: "Multiplataforma", region: "Global", supplierCostUsd: 31.00, priceUsd: 35.99, stock: 40, g2aPriceUsd: 31.50, enebaPriceUsd: 31.00 }
    ]
  },
  {
    id: "m-valorant-1000",
    title: "Valorant Points - 1,000 VP",
    slug: "valorant-points-1000-vp",
    category: "Monedas",
    coverImage: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80&w=600",
    description: "Puntos de Valorant para adquirir skins de armas en la tienda del juego.",
    priceHistory30d: { lowest: 10.49, highest: 12.00, isLowest30d: false },
    variants: [
      { id: "v-vp1000-us", platform: "PC (Steam)", region: "US Store", supplierCostUsd: 9.10, priceUsd: 10.99, stock: 60, g2aPriceUsd: 9.30, enebaPriceUsd: 9.10 }
    ]
  },
  {
    id: "m-valorant-2050",
    title: "Valorant Points - 2,050 VP",
    slug: "valorant-points-2050-vp",
    category: "Monedas",
    coverImage: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80&w=600",
    description: "2,050 Valorant Points para desbloquear paquetes de skins exclusivas.",
    priceHistory30d: { lowest: 20.99, highest: 23.50, isLowest30d: true },
    variants: [
      { id: "v-vp2050-us", platform: "PC (Steam)", region: "US Store", supplierCostUsd: 18.20, priceUsd: 21.50, stock: 35, g2aPriceUsd: 18.60, enebaPriceUsd: 18.20 }
    ]
  },
  {
    id: "m-roblox-800",
    title: "Roblox - 800 Robux Card",
    slug: "roblox-800-robux",
    category: "Monedas",
    coverImage: "https://images.unsplash.com/photo-1614680376593-902f749f7b2c?auto=format&fit=crop&q=80&w=600",
    description: "Tarjeta de regalo oficial de 800 Robux para accesorios y ventajas.",
    priceHistory30d: { lowest: 9.99, highest: 11.50, isLowest30d: false },
    variants: [
      { id: "v-rb800-glo", platform: "Multiplataforma", region: "Global", supplierCostUsd: 8.90, priceUsd: 10.49, stock: 110, g2aPriceUsd: 9.10, enebaPriceUsd: 8.90 }
    ]
  },
  {
    id: "m-roblox-2000",
    title: "Roblox - 2,000 Robux Card",
    slug: "roblox-2000-robux",
    category: "Monedas",
    coverImage: "https://images.unsplash.com/photo-1614680376593-902f749f7b2c?auto=format&fit=crop&q=80&w=600",
    description: "Código de 2,000 Robux para cuenta personal de Roblox.",
    priceHistory30d: { lowest: 24.50, highest: 28.00, isLowest30d: true },
    variants: [
      { id: "v-rb2000-glo", platform: "Multiplataforma", region: "Global", supplierCostUsd: 22.00, priceUsd: 25.99, stock: 45, g2aPriceUsd: 22.40, enebaPriceUsd: 22.00 }
    ]
  },
  {
    id: "m-fc-1050",
    title: "EA Sports FC 26 - 1,050 FC Points",
    slug: "ea-sports-fc-1050-fc-points",
    category: "Monedas",
    coverImage: "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&q=80&w=600",
    description: "Puntos para Ultimate Team (FUT Packs y Ultimate Drafts).",
    priceHistory30d: { lowest: 9.50, highest: 11.20, isLowest30d: false },
    variants: [
      { id: "v-fcp1050-pc", platform: "PC (Steam)", region: "Global", supplierCostUsd: 8.80, priceUsd: 9.99, stock: 50, g2aPriceUsd: 8.95, enebaPriceUsd: 8.80 },
      { id: "v-fcp1050-ps", platform: "PlayStation 5", region: "US Store", supplierCostUsd: 8.90, priceUsd: 10.49, stock: 40, g2aPriceUsd: 9.10, enebaPriceUsd: 8.90 }
    ]
  },
  {
    id: "m-lol-1380",
    title: "League of Legends - 1,380 RP",
    slug: "league-of-legends-1380-rp",
    category: "Monedas",
    coverImage: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80&w=600",
    description: "Puntos Riot RP canjeables en servidor NA y LAN.",
    priceHistory30d: { lowest: 10.50, highest: 12.00, isLowest30d: true },
    variants: [
      { id: "v-lol1380-glo", platform: "PC (Steam)", region: "Global", supplierCostUsd: 9.50, priceUsd: 10.99, stock: 30, g2aPriceUsd: 9.70, enebaPriceUsd: 9.50 }
    ]
  },
  {
    id: "m-cod-2400",
    title: "Call of Duty - 2,400 CP Points",
    slug: "call-of-duty-2400-cp-points",
    category: "Monedas",
    coverImage: "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?auto=format&fit=crop&q=80&w=600",
    description: "2,400 COD Points para Warzone y Black Ops 6.",
    priceHistory30d: { lowest: 19.50, highest: 22.00, isLowest30d: false },
    variants: [
      { id: "v-cp2400-pc", platform: "PC (Steam)", region: "Global", supplierCostUsd: 17.50, priceUsd: 19.99, stock: 25, g2aPriceUsd: 17.90, enebaPriceUsd: 17.50 },
      { id: "v-cp2400-ps", platform: "PlayStation 5", region: "US Store", supplierCostUsd: 18.00, priceUsd: 20.99, stock: 30, g2aPriceUsd: 18.40, enebaPriceUsd: 18.00 }
    ]
  },
  {
    id: "m-freefire-1080",
    title: "Free Fire - 1,080 + 108 Diamantes",
    slug: "free-fire-1080-diamonds",
    category: "Monedas",
    coverImage: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80&w=600",
    description: "Diamantes oficiales para Free Fire con recarga directa por ID.",
    tag: "NUEVO",
    priceHistory30d: { lowest: 9.99, highest: 12.00, isLowest30d: true },
    variants: [
      { id: "v-ff1080-glo", platform: "Multiplataforma", region: "Global", supplierCostUsd: 8.90, priceUsd: 10.50, stock: 100, g2aPriceUsd: 9.10, enebaPriceUsd: 8.90 }
    ]
  },

  // --- SUSCRIPCIONES ---
  {
    id: "s-psplus-essential-1m",
    title: "PlayStation Plus Essential (1 Mes)",
    slug: "playstation-plus-essential-1-month",
    category: "Suscripciones",
    coverImage: "https://images.unsplash.com/photo-1606813907291-d86efa9b94db?auto=format&fit=crop&q=80&w=600",
    description: "Acceso al multijugador online y 3 juegos mensuales en PS4 / PS5.",
    priceHistory30d: { lowest: 9.20, highest: 11.00, isLowest30d: false },
    variants: [
      { id: "v-psess1m-us", platform: "PlayStation 5", region: "US Store", supplierCostUsd: 8.50, priceUsd: 9.99, stock: 40, g2aPriceUsd: 8.80, enebaPriceUsd: 8.50 }
    ]
  },
  {
    id: "s-psplus-extra-1m",
    title: "PlayStation Plus Extra (1 Mes)",
    slug: "playstation-plus-extra-1-month",
    category: "Suscripciones",
    coverImage: "https://images.unsplash.com/photo-1606813907291-d86efa9b94db?auto=format&fit=crop&q=80&w=600",
    description: "Incluye catálogo de cientos de juegos de PS4 y PS5 para descargar.",
    priceHistory30d: { lowest: 14.50, highest: 16.99, isLowest30d: true },
    variants: [
      { id: "v-psext1m-us", platform: "PlayStation 5", region: "US Store", supplierCostUsd: 13.00, priceUsd: 14.99, stock: 25, g2aPriceUsd: 13.40, enebaPriceUsd: 13.00 }
    ]
  },
  {
    id: "s-psplus-deluxe-3m",
    title: "PlayStation Plus Deluxe (3 Meses)",
    slug: "playstation-plus-deluxe-3-months",
    category: "Suscripciones",
    coverImage: "https://images.unsplash.com/photo-1606813907291-d86efa9b94db?auto=format&fit=crop&q=80&w=600",
    description: "Catálogo completo, juegos clásicos y pruebas exclusivas de juegos.",
    priceHistory30d: { lowest: 37.99, highest: 42.00, isLowest30d: true },
    variants: [
      { id: "v-psdel3m-us", platform: "PlayStation 5", region: "US Store", supplierCostUsd: 34.00, priceUsd: 38.99, stock: 15, g2aPriceUsd: 34.80, enebaPriceUsd: 34.00 }
    ]
  },
  {
    id: "s-discord-nitro-1m",
    title: "Discord Nitro (1 Mes)",
    slug: "discord-nitro-1-month",
    category: "Suscripciones",
    coverImage: "https://images.unsplash.com/photo-1614680376593-902f749f7b2c?auto=format&fit=crop&q=80&w=600",
    description: "Mejora tu perfil con emojis personalizados, transmisión HD y 2 Server Boosts.",
    priceHistory30d: { lowest: 9.50, highest: 11.00, isLowest30d: false },
    variants: [
      { id: "v-nitro1m-glo", platform: "Multiplataforma", region: "Global", supplierCostUsd: 8.20, priceUsd: 9.99, stock: 50, g2aPriceUsd: 8.50, enebaPriceUsd: 8.20 }
    ]
  },
  {
    id: "s-gamepass-ult-1m",
    title: "Xbox Game Pass Ultimate (1 Mes)",
    slug: "xbox-game-pass-ultimate-1-month",
    category: "Suscripciones",
    coverImage: "https://images.unsplash.com/photo-1621259182978-fbf93132d53d?auto=format&fit=crop&q=80&w=600",
    bannerImage: "https://images.unsplash.com/photo-1621259182978-fbf93132d53d?auto=format&fit=crop&q=80&w=1200",
    description: "Más de 100 juegos de consola y PC con EA Play y multijugador online.",
    featured: true,
    tag: "IMPERDIBLE",
    priceHistory30d: { lowest: 14.99, highest: 18.00, isLowest30d: true },
    variants: [
      { id: "v-gpu1m-glo", platform: "Multiplataforma", region: "Global", supplierCostUsd: 13.50, priceUsd: 15.99, stock: 70, g2aPriceUsd: 13.90, enebaPriceUsd: 13.50 }
    ]
  },

  // --- JUEGOS TOP AAA ---
  {
    id: "j-eafc-26",
    title: "EA Sports FC 26",
    slug: "ea-sports-fc-26",
    category: "AAA",
    coverImage: "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&q=80&w=600",
    bannerImage: "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&q=80&w=1200",
    description: "El simulador de fútbol definitivo con la tecnología HyperMotionV actualizada.",
    featured: true,
    tag: "NUEVO",
    priceHistory30d: { lowest: 47.99, highest: 59.99, isLowest30d: true },
    variants: [
      { id: "v-fc26-pc", platform: "PC (Steam)", region: "Global", supplierCostUsd: 45.00, priceUsd: 49.99, stock: 35, g2aPriceUsd: 46.20, enebaPriceUsd: 45.00 },
      { id: "v-fc26-ps", platform: "PlayStation 5", region: "US Store", supplierCostUsd: 55.00, priceUsd: 59.99, stock: 20, g2aPriceUsd: 56.10, enebaPriceUsd: 55.00 },
      { id: "v-fc26-nin", platform: "Nintendo Switch", region: "US Store", supplierCostUsd: 40.00, priceUsd: 44.99, stock: 15, g2aPriceUsd: 41.00, enebaPriceUsd: 40.00 }
    ]
  },
  {
    id: "j-gta-v",
    title: "Grand Theft Auto V: Premium Edition",
    slug: "gta-v-premium-edition",
    category: "AAA",
    coverImage: "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?auto=format&fit=crop&q=80&w=600",
    description: "Incluye la historia completa de GTA V y acceso directo a GTA Online.",
    tag: "OFERTA TOP",
    priceHistory30d: { lowest: 13.99, highest: 17.50, isLowest30d: false },
    variants: [
      { id: "v-gtav-pc", platform: "PC (Steam)", region: "Global", supplierCostUsd: 12.00, priceUsd: 14.50, stock: 90, g2aPriceUsd: 12.80, enebaPriceUsd: 12.00 },
      { id: "v-gtav-ps", platform: "PlayStation 5", region: "US Store", supplierCostUsd: 15.00, priceUsd: 18.99, stock: 40, g2aPriceUsd: 15.60, enebaPriceUsd: 15.00 }
    ]
  },
  {
    id: "j-wukong",
    title: "Black Myth: Wukong",
    slug: "black-myth-wukong",
    category: "AAA",
    coverImage: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80&w=600",
    bannerImage: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80&w=1200",
    description: "Juego de rol y acción inspirado en la mitología china y la leyenda del Rey Mono.",
    featured: true,
    tag: "GOTY CANDIDATE",
    priceHistory30d: { lowest: 52.99, highest: 59.99, isLowest30d: true },
    variants: [
      { id: "v-wukong-pc", platform: "PC (Steam)", region: "Global", supplierCostUsd: 48.00, priceUsd: 54.99, stock: 30, g2aPriceUsd: 49.50, enebaPriceUsd: 48.00 },
      { id: "v-wukong-ps", platform: "PlayStation 5", region: "US Store", supplierCostUsd: 54.00, priceUsd: 59.99, stock: 18, g2aPriceUsd: 55.20, enebaPriceUsd: 54.00 }
    ]
  },
  {
    id: "j-helldivers-2",
    title: "Helldivers 2",
    slug: "helldivers-2",
    category: "AAA",
    coverImage: "https://images.unsplash.com/photo-1579373903781-fd5c0c30c4cd?auto=format&fit=crop&q=80&w=600",
    description: "Shooter cooperativo galáctico en tercera persona por la Supertierra.",
    priceHistory30d: { lowest: 33.99, highest: 39.99, isLowest30d: false },
    variants: [
      { id: "v-hd2-pc", platform: "PC (Steam)", region: "Global", supplierCostUsd: 31.00, priceUsd: 34.99, stock: 50, g2aPriceUsd: 31.80, enebaPriceUsd: 31.00 },
      { id: "v-hd2-ps", platform: "PlayStation 5", region: "US Store", supplierCostUsd: 34.00, priceUsd: 37.99, stock: 25, g2aPriceUsd: 34.90, enebaPriceUsd: 34.00 }
    ]
  },
  {
    id: "j-gow-rag",
    title: "God of War Ragnarök",
    slug: "god-of-war-ragnarok",
    category: "AAA",
    coverImage: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80&w=600",
    description: "Embarca en un viaje épico a través de los Nueve Reinos con Kratos y Atreus.",
    priceHistory30d: { lowest: 46.99, highest: 55.00, isLowest30d: false },
    variants: [
      { id: "v-gowr-pc", platform: "PC (Steam)", region: "Global", supplierCostUsd: 44.00, priceUsd: 49.99, stock: 22, g2aPriceUsd: 45.00, enebaPriceUsd: 44.00 },
      { id: "v-gowr-ps", platform: "PlayStation 5", region: "US Store", supplierCostUsd: 48.00, priceUsd: 53.99, stock: 30, g2aPriceUsd: 49.10, enebaPriceUsd: 48.00 }
    ]
  },
  {
    id: "j-cs2-prime",
    title: "Counter-Strike 2 - Estatus Prime",
    slug: "cs2-prime-status",
    category: "AAA",
    coverImage: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80&w=600",
    description: "Estatus Prime oficial para matchmaking exclusivo y drops semanales en CS2.",
    priceHistory30d: { lowest: 14.50, highest: 16.00, isLowest30d: true },
    variants: [
      { id: "v-cs2p-pc", platform: "PC (Steam)", region: "Global", supplierCostUsd: 13.50, priceUsd: 14.99, stock: 65, g2aPriceUsd: 13.90, enebaPriceUsd: 13.50 }
    ]
  },
  {
    id: "j-rust",
    title: "Rust",
    slug: "rust-game-pc",
    category: "AAA",
    coverImage: "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?auto=format&fit=crop&q=80&w=600",
    description: "Supervive, construye refugios y forma alianzas en el juego definitivo de supervivencia sandbox.",
    priceHistory30d: { lowest: 23.99, highest: 29.99, isLowest30d: false },
    variants: [
      { id: "v-rust-pc", platform: "PC (Steam)", region: "Global", supplierCostUsd: 21.00, priceUsd: 24.99, stock: 40, g2aPriceUsd: 21.70, enebaPriceUsd: 21.00 }
    ]
  },
  {
    id: "j-minecraft",
    title: "Minecraft: Java & Bedrock Edition",
    slug: "minecraft-java-bedrock",
    category: "AAA",
    coverImage: "https://images.unsplash.com/photo-1627856013091-fed6e4e30025?auto=format&fit=crop&q=80&w=600",
    description: "Construye y explora mundos infinitos. Incluye ediciones Java y Bedrock para PC.",
    priceHistory30d: { lowest: 18.99, highest: 22.00, isLowest30d: true },
    variants: [
      { id: "v-mc-pc", platform: "PC (Steam)", region: "Global", supplierCostUsd: 17.50, priceUsd: 19.99, stock: 100, g2aPriceUsd: 18.00, enebaPriceUsd: 17.50 },
      { id: "v-mc-nin", platform: "Nintendo Switch", region: "US Store", supplierCostUsd: 24.00, priceUsd: 27.99, stock: 30, g2aPriceUsd: 24.80, enebaPriceUsd: 24.00 }
    ]
  },
  {
    id: "j-cyberpunk-2077",
    title: "Cyberpunk 2077: Phantom Liberty",
    slug: "cyberpunk-2077-phantom-liberty",
    category: "AAA",
    coverImage: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80&w=600",
    description: "Aventura de espionaje y acción RPG en la megalópolis de Night City.",
    priceHistory30d: { lowest: 25.00, highest: 31.00, isLowest30d: false },
    variants: [
      { id: "v-cp2077-pc", platform: "PC (Steam)", region: "Global", supplierCostUsd: 22.00, priceUsd: 26.99, stock: 40, g2aPriceUsd: 22.80, enebaPriceUsd: 22.00 },
      { id: "v-cp2077-ps", platform: "PlayStation 5", region: "US Store", supplierCostUsd: 28.00, priceUsd: 32.99, stock: 15, g2aPriceUsd: 28.90, enebaPriceUsd: 28.00 }
    ]
  },
  {
    id: "j-elden-ring",
    title: "Elden Ring: Shadow of the Erdtree",
    slug: "elden-ring-shadow-of-the-erdtree",
    category: "AAA",
    coverImage: "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&q=80&w=600",
    description: "El aclamado RPG de acción de FromSoftware junto a su expansión oficial.",
    priceHistory30d: { lowest: 41.50, highest: 49.99, isLowest30d: true },
    variants: [
      { id: "v-er-pc", platform: "PC (Steam)", region: "Global", supplierCostUsd: 38.00, priceUsd: 42.99, stock: 22, g2aPriceUsd: 38.90, enebaPriceUsd: 38.00 },
      { id: "v-er-ps", platform: "PlayStation 5", region: "US Store", supplierCostUsd: 44.00, priceUsd: 48.99, stock: 15, g2aPriceUsd: 44.70, enebaPriceUsd: 44.00 }
    ]
  },

  // --- CLÁSICOS ECONÓMICOS ---
  {
    id: "j-l4d2",
    title: "Left 4 Dead 2",
    slug: "left-4-dead-2",
    category: "Clásicos",
    coverImage: "https://images.unsplash.com/photo-1579373903781-fd5c0c30c4cd?auto=format&fit=crop&q=80&w=600",
    description: "El icónico shooter cooperativo de zombis en primera persona de Valve.",
    priceHistory30d: { lowest: 3.50, highest: 4.99, isLowest30d: true },
    variants: [
      { id: "v-l4d2-pc", platform: "PC (Steam)", region: "Global", supplierCostUsd: 1.80, priceUsd: 3.99, stock: 100, g2aPriceUsd: 2.10, enebaPriceUsd: 1.80 }
    ]
  },
  {
    id: "j-terraria",
    title: "Terraria",
    slug: "terraria",
    category: "Clásicos",
    coverImage: "https://images.unsplash.com/photo-1627856013091-fed6e4e30025?auto=format&fit=crop&q=80&w=600",
    description: "Explora, cava, combate y construye en este aclamado juego de aventura sandbox 2D.",
    priceHistory30d: { lowest: 4.50, highest: 5.99, isLowest30d: false },
    variants: [
      { id: "v-ter-pc", platform: "PC (Steam)", region: "Global", supplierCostUsd: 3.20, priceUsd: 4.99, stock: 75, g2aPriceUsd: 3.50, enebaPriceUsd: 3.20 }
    ]
  },
  {
    id: "j-zomboid",
    title: "Project Zomboid",
    slug: "project-zomboid",
    category: "Clásicos",
    coverImage: "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?auto=format&fit=crop&q=80&w=600",
    description: "Simulador definitivo realista de supervivencia zombi con multijugador.",
    priceHistory30d: { lowest: 8.50, highest: 10.20, isLowest30d: true },
    variants: [
      { id: "v-pz-pc", platform: "PC (Steam)", region: "Global", supplierCostUsd: 7.00, priceUsd: 8.99, stock: 60, g2aPriceUsd: 7.40, enebaPriceUsd: 7.00 }
    ]
  },
  {
    id: "j-stardew-valley",
    title: "Stardew Valley",
    slug: "stardew-valley",
    category: "Clásicos",
    coverImage: "https://images.unsplash.com/photo-1627856013091-fed6e4e30025?auto=format&fit=crop&q=80&w=600",
    description: "Hereda la granja de tu abuelo y construye la vida agrícola de tus sueños.",
    priceHistory30d: { lowest: 6.50, highest: 8.99, isLowest30d: false },
    variants: [
      { id: "v-sv-pc", platform: "PC (Steam)", region: "Global", supplierCostUsd: 4.50, priceUsd: 6.99, stock: 80, g2aPriceUsd: 4.80, enebaPriceUsd: 4.50 },
      { id: "v-sv-nin", platform: "Nintendo Switch", region: "US Store", supplierCostUsd: 6.00, priceUsd: 8.50, stock: 40, g2aPriceUsd: 6.30, enebaPriceUsd: 6.00 }
    ]
  },
  {
    id: "j-among-us",
    title: "Among Us",
    slug: "among-us",
    category: "Clásicos",
    coverImage: "https://images.unsplash.com/photo-1614680376593-902f749f7b2c?auto=format&fit=crop&q=80&w=600",
    description: "Juego de trabajo en equipo y deducción social en el espacio para 4-15 jugadores.",
    priceHistory30d: { lowest: 3.20, highest: 4.50, isLowest30d: true },
    variants: [
      { id: "v-au-pc", platform: "PC (Steam)", region: "Global", supplierCostUsd: 2.00, priceUsd: 3.50, stock: 120, g2aPriceUsd: 2.20, enebaPriceUsd: 2.00 }
    ]
  }
];

const CATEGORIES = [
  { name: 'Todos', icon: Gamepad2, color: 'from-violet-500 to-purple-600' },
  { name: 'Gift Cards', icon: Tag, color: 'from-blue-500 to-cyan-500' },
  { name: 'Monedas', icon: Sparkles, color: 'from-amber-400 to-orange-500' },
  { name: 'Suscripciones', icon: Play, color: 'from-blue-600 to-indigo-700' },
  { name: 'AAA', icon: Flame, color: 'from-red-500 to-pink-600' },
  { name: 'Clásicos', icon: Cpu, color: 'from-emerald-500 to-green-600' }
];

const SOCIAL_PROOF_ACTIVITIES = [
  { buyer: 'Carlos M.', gameId: 'g-steam-20', variantId: 'v-s20-glo', icon: '🔥' },
  { buyer: 'José R.', gameId: 'g-xbox-20', variantId: 'v-x20-us', icon: '🎮' },
  { buyer: 'Andrea P.', gameId: 'g-psn-25', variantId: 'v-ps25-us', icon: '✨' },
  { buyer: 'Luis F.', gameId: 'g-nin-50', variantId: 'v-n50-us', icon: '🕹️' }
];

function RecentActivityNotification({
  onProductClick,
}: {
  onProductClick: (gameId: string) => void;
}) {
  const [activityIndex, setActivityIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    let transitionTimer: ReturnType<typeof setTimeout>;
    const rotationTimer = setInterval(() => {
      setIsVisible(false);
      transitionTimer = setTimeout(() => {
        setActivityIndex((index) => (index + 1) % SOCIAL_PROOF_ACTIVITIES.length);
        setIsVisible(true);
      }, 350);
    }, 6000);

    return () => {
      clearInterval(rotationTimer);
      clearTimeout(transitionTimer);
    };
  }, []);

  const activity = SOCIAL_PROOF_ACTIVITIES[activityIndex];
  const game = MOCK_GAMES.find((item) => item.id === activity.gameId);
  const variant = game?.variants.find((item) => item.id === activity.variantId);

  if (!game || !variant) {
    return null;
  }

  return (
    <aside
      aria-label="Actividad de demostración"
      aria-live="polite"
      className={`fixed bottom-20 left-4 z-30 w-[min(22rem,calc(100vw-2rem))] md:bottom-6 md:left-6 transition-all duration-300 ease-out motion-reduce:transition-none ${
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'
      }`}
    >
      <button
        type="button"
        onClick={() => onProductClick(game.id)}
        className="w-full rounded-2xl border border-purple-400/30 bg-slate-950/90 p-3 text-left shadow-xl shadow-purple-950/40 backdrop-blur-xl transition hover:border-purple-400/70 hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
        aria-label={`Actividad simulada: ${activity.buyer}, ${game.title}, plataforma ${variant.platform}. Ir al producto.`}
      >
        <span className="mb-1.5 flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider text-purple-300">
          <Activity className="h-3 w-3 text-cyan-300" />
          Ejemplo · actividad simulada
        </span>
        <span className="flex items-start gap-2 text-xs leading-relaxed text-slate-200">
          <span aria-hidden="true" className="text-sm">{activity.icon}</span>
          <span>
            <strong className="text-white">{activity.buyer}</strong>
            {' seleccionó '}
            <strong className="text-cyan-200">{game.title}</strong>
            <span className="block text-[11px] text-slate-400">{variant.platform}</span>
          </span>
        </span>
      </button>
    </aside>
  );
}

// ============================================================================
// 2. COMPONENTE PRINCIPAL
// ============================================================================

export default function App() {
  // Tasas Financieras
  const [bcvRate, setBcvRate] = useState<number | null>(null);
  const [bcvRateError, setBcvRateError] = useState<string | null>(null);
  const [binanceP2PRate] = useState(1050.25);

  // Navegación e Interfaz PWA
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [selectedSubCategory, setSelectedSubCategory] = useState('Todas');
  const [selectedPlatformFilter] = useState('Todas');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentSlide, setCurrentSlide] = useState(0);
  const [activeTab, setActiveTab] = useState('home'); // 'home' | 'profile' | 'admin'
  const [, setAddedToast] = useState(null);

  // Fidelización y Usuario Passwordless
  const [user, setUser] = useState(null);
  const [gamerPoints, setGamerPoints] = useState(0);
  const [usePointsInCheckout, setUsePointsInCheckout] = useState(false);
  const [userOrders, setUserOrders] = useState([]);

  // Panel de Administración Oculto
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [showAdminLoginModal, setShowAdminLoginModal] = useState(false);
  const [adminLoginForm, setAdminLoginForm] = useState({ email: '', password: '' });
  const [adminTab, setAdminTab] = useState('sales'); // 'sales' | 'analytics'

  // Formulario Checkout
  const [checkoutForm, setCheckoutForm] = useState({
    email: '',
    phone: '',
    paymentMethod: 'pago_movil',
    referenceNumber: '',
  });
  const [isProcessingOrder, setIsProcessingOrder] = useState(false);
  const [, setCompletedOrder] = useState(null);

  // Selección de variante por producto
  const [selectedVariants, setSelectedVariants] = useState(() => {
    const initial = {};
    MOCK_GAMES.forEach(game => {
      if (game.variants && game.variants.length > 0) {
        initial[game.id] = game.variants[0].id;
      }
    });
    return initial;
  });

  // Ventas globales en memoria para el Admin Panel
  const [adminSalesHistory, setAdminSalesHistory] = useState([
    {
      id: 'VK-784192',
      date: '06/11/2026',
      customerEmail: 'gamer_caracas@gmail.com',
      phone: '0412-9988776',
      paymentMethod: 'Pago Móvil (Banesco)',
      referenceNumber: '8849102',
      totalUsd: 21.50,
      totalBs: 22581,
      status: 'Aprobado',
      items: [
        {
          name: 'Steam Gift Card $20 USD (PC)',
          variantId: 'v-s20-glo',
          gameId: 'g-steam-20',
          priceUsd: 21.50,
          bestSupplier: 'Eneba',
          supplierCostUsd: 19.50,
          g2aPriceUsd: 19.90,
          enebaPriceUsd: 19.50,
          profitMarginUsd: 2.00
        }
      ]
    },
    {
      id: 'VK-551029',
      date: '06/11/2026',
      customerEmail: 'el_pepe_ps5@hotmail.com',
      phone: '0424-1122334',
      paymentMethod: 'Pago Móvil (Mercantil)',
      referenceNumber: '4910023',
      totalUsd: 59.99,
      totalBs: 63005,
      status: 'Pendiente',
      items: [
        {
          name: 'EA Sports FC 26 (PlayStation 5)',
          variantId: 'v-fc26-ps',
          gameId: 'j-eafc-26',
          priceUsd: 59.99,
          bestSupplier: 'Eneba',
          supplierCostUsd: 55.00,
          g2aPriceUsd: 56.10,
          enebaPriceUsd: 55.00,
          profitMarginUsd: 4.99
        }
      ]
    }
  ]);

  const heroItems = useMemo(() => MOCK_GAMES.filter(g => g.featured), []);

  useEffect(() => {
    if (heroItems.length === 0) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroItems.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [heroItems.length]);

  useEffect(() => {
    const controller = new AbortController();

    const fetchBcvRate = async () => {
      try {
        const response = await fetch('https://ve.dolarapi.com/v1/dolares/oficial', {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`La API BCV respondió con el estado ${response.status}.`);
        }

        const data: unknown = await response.json();
        if (typeof data !== 'object' || data === null || !('promedio' in data)) {
          throw new Error('La respuesta de la API BCV no contiene una tasa válida.');
        }

        const rate = data.promedio;
        if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
          throw new Error('La respuesta de la API BCV no contiene una tasa válida.');
        }

        setBcvRate(rate);
        setBcvRateError(null);
      } catch (error) {
        if (controller.signal.aborted) return;
        setBcvRateError(error instanceof Error ? error.message : 'No se pudo consultar la tasa BCV.');
      }
    };

    void fetchBcvRate();
    const refreshTimer = setInterval(() => {
      void fetchBcvRate();
    }, 15 * 60 * 1000);

    return () => {
      controller.abort();
      clearInterval(refreshTimer);
    };
  }, []);

  const bsfCoverageFactor = useMemo(
    () => (bcvRate === null ? null : binanceP2PRate / bcvRate),
    [binanceP2PRate, bcvRate]
  );

  const calculateBsNumeric = (priceUsd) => {
    return bcvRate === null ? null : Math.ceil(priceUsd * bcvRate);
  };

  const calculateBs = (priceUsd) => {
    const totalBs = calculateBsNumeric(priceUsd);
    if (totalBs === null) return '—';
    return new Intl.NumberFormat('es-VE', { maximumFractionDigits: 0 }).format(totalBs);
  };

  const totalCartUsd = cart.reduce((acc, item) => acc + (item.priceUsd * item.quantity), 0);
  const totalCartItems = cart.reduce((acc, item) => acc + item.quantity, 0);

  // Cálculo de Descuento por Gamer Cash Points (100 puntos = $1 USD)
  const pointsUsdDiscount = useMemo(() => {
    if (!usePointsInCheckout) return 0;
    return Math.min(gamerPoints / 100, totalCartUsd);
  }, [usePointsInCheckout, gamerPoints, totalCartUsd]);

  const finalCheckoutUsd = useMemo(() => Math.max(0, totalCartUsd - pointsUsdDiscount), [totalCartUsd, pointsUsdDiscount]);

  const handleVariantSelect = (gameId, variantId) => {
    setSelectedVariants(prev => ({ ...prev, [gameId]: variantId }));
  };

  const handleActivityProductClick = (gameId) => {
    setActiveTab('home');
    setSelectedCategory('Todos');
    setSelectedSubCategory('Todas');
    setSearchQuery('');

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.getElementById(`product-${gameId}`)?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      });
    });
  };

  const addToCart = (game, variant) => {
    const cartItemId = `${game.id}-${variant.id}`;
    setCart(prev => {
      const existing = prev.find(item => item.cartItemId === cartItemId);
      if (existing) {
        return prev.map(item => item.cartItemId === cartItemId ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, {
        cartItemId,
        gameId: game.id,
        title: game.title,
        coverImage: game.coverImage,
        platform: variant.platform,
        region: variant.region,
        priceUsd: variant.priceUsd,
        supplierCostUsd: variant.supplierCostUsd,
        g2aPriceUsd: variant.g2aPriceUsd || variant.supplierCostUsd,
        enebaPriceUsd: variant.enebaPriceUsd || variant.supplierCostUsd,
        quantity: 1
      }];
    });

    setAddedToast(`${game.title} (${variant.platform})`);
    setTimeout(() => setAddedToast(null), 3000);
  };

  const updateQuantity = (cartItemId, change) => {
    setCart(prev => prev.map(item => {
      if (item.cartItemId === cartItemId) {
        const newQty = item.quantity + change;
        return newQty > 0 ? { ...item, quantity: newQty } : item;
      }
      return item;
    }));
  };

  // Login del Administrador
  const handleAdminLogin = (e) => {
    e.preventDefault();
    if (adminLoginForm.email === 'admin@lacasitagamer.com' && adminLoginForm.password === '654321') {
      setIsAdminAuthenticated(true);
      setShowAdminLoginModal(false);
      setActiveTab('admin');
    } else {
      alert("Credenciales administrativas inválidas.");
    }
  };

  // Cerrar Sesión del Administrador
  const handleAdminLogout = () => {
    setIsAdminAuthenticated(false);
    setActiveTab('home');
  };

  // Procesar Compra y Generación de Puntos Gamer Cash
  const handleProcessOrder = (e) => {
    e.preventDefault();
    if (bcvRate === null) {
      alert('No se puede procesar el pedido hasta obtener la tasa oficial BCV.');
      return;
    }

    if (!checkoutForm.email || !checkoutForm.phone || !checkoutForm.referenceNumber) {
      alert("Por favor completa todos los campos del reporte de pago.");
      return;
    }

    setIsProcessingOrder(true);

    setTimeout(() => {
      // 10 puntos por cada $1 gastado
      const earnedPoints = Math.floor(finalCheckoutUsd * 10);
      const updatedPoints = (usePointsInCheckout ? gamerPoints - (pointsUsdDiscount * 100) : gamerPoints) + earnedPoints;

      const itemsWithArbitrage = cart.map(item => {
        const g2a = item.g2aPriceUsd || item.supplierCostUsd;
        const eneba = item.enebaPriceUsd || item.supplierCostUsd;
        const lowestSupplierCost = Math.min(g2a, eneba);
        const bestSupplier = eneba <= g2a ? 'Eneba' : 'G2A';

        return {
          name: `${item.title} (${item.platform})`,
          variantId: item.cartItemId,
          gameId: item.gameId,
          priceUsd: item.priceUsd,
          bestSupplier,
          supplierCostUsd: lowestSupplierCost,
          g2aPriceUsd: g2a,
          enebaPriceUsd: eneba,
          profitMarginUsd: item.priceUsd - lowestSupplierCost
        };
      });

      const generatedOrder = {
        id: `VK-${Math.floor(100000 + Math.random() * 900000)}`,
        date: new Date().toLocaleDateString('es-VE'),
        customerEmail: checkoutForm.email,
        phone: checkoutForm.phone,
        paymentMethod: checkoutForm.paymentMethod,
        referenceNumber: checkoutForm.referenceNumber,
        totalUsd: finalCheckoutUsd,
        totalBs: calculateBsNumeric(finalCheckoutUsd),
        status: 'Aprobado',
        items: itemsWithArbitrage,
        generatedKeys: cart.map(item => ({
          title: item.title,
          platform: item.platform,
          key: `${item.platform.substring(0,3).toUpperCase()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`
        }))
      };

      setUser({ email: checkoutForm.email, phone: checkoutForm.phone });
      setGamerPoints(updatedPoints);
      setUserOrders(prev => [generatedOrder, ...prev]);
      setAdminSalesHistory(prev => [generatedOrder, ...prev]);
      setCompletedOrder(generatedOrder);
      setCart([]);
      setUsePointsInCheckout(false);
      setIsProcessingOrder(false);
      setIsCheckoutOpen(false);
    }, 1200);
  };

  const approveSaleAdmin = (orderId) => {
    setAdminSalesHistory(prev => prev.map(o => o.id === orderId ? { ...o, status: 'Aprobado' } : o));
  };

  const filteredProducts = useMemo(() => {
    return MOCK_GAMES.filter(game => {
      const matchesCategory = selectedCategory === 'Todos' || game.category === selectedCategory;

      let matchesSubCategory = true;
      if (selectedSubCategory !== 'Todas') {
        const titleLower = game.title.toLowerCase();
        const subLower = selectedSubCategory.toLowerCase();
        if (subLower === 'steam') matchesSubCategory = titleLower.includes('steam');
        else if (subLower === 'psn') matchesSubCategory = titleLower.includes('playstation') || titleLower.includes('psn');
        else if (subLower === 'nintendo') matchesSubCategory = titleLower.includes('nintendo');
        else if (subLower === 'xbox') matchesSubCategory = titleLower.includes('xbox');
        else if (subLower === 'apple & google') matchesSubCategory = titleLower.includes('apple') || titleLower.includes('google');
        else if (subLower === 'v-bucks (fortnite)') matchesSubCategory = titleLower.includes('fortnite') || titleLower.includes('pavos') || titleLower.includes('v-bucks');
        else if (subLower === 'free fire') matchesSubCategory = titleLower.includes('free fire') || titleLower.includes('diamantes');
        else if (subLower === 'valorant (vp)') matchesSubCategory = titleLower.includes('valorant');
        else if (subLower === 'roblox (robux)') matchesSubCategory = titleLower.includes('roblox') || titleLower.includes('robux');
        else if (subLower === 'fc points') matchesSubCategory = titleLower.includes('fc points') || titleLower.includes('fifa');
        else if (subLower === 'league of legends') matchesSubCategory = titleLower.includes('league of legends') || titleLower.includes('riot');
        else if (subLower === 'cod points') matchesSubCategory = titleLower.includes('call of duty') || titleLower.includes('cp points');
      }

      const matchesPlatform = selectedPlatformFilter === 'Todas' || 
        game.variants.some(v => v.platform.toLowerCase().includes(selectedPlatformFilter.toLowerCase()));
      const matchesSearch = game.title.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesCategory && matchesSubCategory && matchesPlatform && matchesSearch;
    });
  }, [selectedCategory, selectedSubCategory, selectedPlatformFilter, searchQuery]);

  return (
    <div className="min-h-screen bg-[#070A10] text-slate-100 font-sans pb-20 md:pb-10 selection:bg-purple-600 selection:text-white">
      
      {/* GLOW DE FONDO */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="fixed top-1/3 right-10 w-96 h-96 bg-cyan-500/10 rounded-full blur-[140px] pointer-events-none" />

      {/* HEADER SUPERIOR */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-[#090D16]/85 border-b border-purple-900/30 shadow-lg shadow-purple-950/20">
        <div className="bg-gradient-to-r from-purple-950 via-indigo-950 to-slate-950 px-4 py-1.5 text-xs text-slate-300 flex justify-between items-center border-b border-purple-800/20">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-purple-300 font-semibold">Tasa Oficial BCV:</span> 
            <span className="text-white font-bold font-mono" aria-live="polite" title={bcvRateError ?? undefined}>
              {bcvRate === null ? (bcvRateError ? 'No disponible' : 'Consultando...') : `1 USD = ${bcvRate.toFixed(2)} Bs.`}
            </span>
            {bcvRate !== null && bcvRateError && (
              <span className="text-amber-300" title={bcvRateError}> (desactualizada)</span>
            )}
            <span className="text-slate-500 hidden sm:inline">|</span>
            <span className="text-cyan-300 font-semibold hidden sm:inline">Binance P2P:</span>
            <span className="text-cyan-400 font-bold font-mono hidden sm:inline">{binanceP2PRate.toFixed(2)} Bs.</span>
          </div>

          <div className="flex items-center gap-3">
            {isAdminAuthenticated ? (
              <div className="flex items-center gap-2">
                <span className="bg-purple-900/80 text-purple-200 border border-purple-500/30 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-cyan-400" /> Admin Activo
                </span>
                <button 
                  onClick={handleAdminLogout}
                  className="bg-red-500/20 hover:bg-red-500/40 text-red-300 border border-red-500/40 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 transition"
                >
                  <LogOut className="w-3 h-3" /> Salir
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setShowAdminLoginModal(true)}
                className="text-slate-500 hover:text-slate-300 text-[11px] font-mono hover:underline"
              >
                Acceso Admin
              </button>
            )}
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div 
            onClick={() => setActiveTab('home')}
            className="flex items-center gap-2 cursor-pointer group"
          >
            <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-cyan-400 p-[1px] shadow-lg shadow-purple-500/30 group-hover:shadow-purple-500/50 transition">
              <div className="w-full h-full bg-[#090D16] rounded-[11px] flex items-center justify-center">
                <Gamepad2 className="w-6 h-6 text-purple-400 group-hover:scale-110 transition-transform" />
              </div>
            </div>
            <div>
              <span className="text-xl font-black tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-purple-300">
                LA CASITA<span className="text-purple-400"> GAMER</span>
              </span>
              <span className="block text-[9px] font-bold uppercase tracking-widest text-cyan-400 -mt-1">
                Keys & Gift Cards Venezuela
              </span>
            </div>
          </div>

          <div className="hidden md:flex flex-1 max-w-xl relative">
            <div className="relative w-full">
              <input 
                type="text"
                placeholder="Buscar gift cards, juegos, pavos, suscripciones..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900/90 border border-purple-500/20 focus:border-purple-500 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30 transition shadow-inner"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-3 text-slate-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsCartOpen(true)}
              className="relative p-2.5 bg-gradient-to-r from-purple-900/40 to-slate-900 border border-purple-500/40 rounded-xl hover:border-purple-400 transition shadow-md group"
            >
              <ShoppingCart className="w-5 h-5 text-purple-300 group-hover:scale-110 transition-transform" />
              {totalCartItems > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-gradient-to-r from-pink-500 to-purple-600 text-white text-[10px] font-extrabold w-5 h-5 rounded-full flex items-center justify-center shadow-lg border border-slate-950 animate-bounce">
                  {totalCartItems}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL */}
      <main className="max-w-7xl mx-auto px-4 pt-6 space-y-8">
        
        {/* PANEL ADMIN OCULTO */}
        {activeTab === 'admin' && isAdminAuthenticated ? (
          <div className="space-y-6 bg-slate-900/80 p-6 rounded-2xl border border-purple-900/50 shadow-2xl">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-800">
              <div>
                <h1 className="text-2xl font-black text-white flex items-center gap-2">
                  <Lock className="w-6 h-6 text-purple-400" /> Panel de Administración Privado
                </h1>
                <p className="text-xs text-slate-400">Verificación de ventas y analíticas de arbitraje de precios.</p>
              </div>

              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setAdminTab('sales')}
                  className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition ${
                    adminTab === 'sales' ? 'bg-purple-600 border-purple-400 text-white' : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  Ventas & Verificación
                </button>
                <button 
                  onClick={() => setAdminTab('analytics')}
                  className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition ${
                    adminTab === 'analytics' ? 'bg-purple-600 border-purple-400 text-white' : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  Analíticas & Métricas
                </button>
                <button 
                  onClick={handleAdminLogout}
                  className="bg-red-600/30 hover:bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-xl border border-red-500/50 transition flex items-center gap-1"
                >
                  <LogOut className="w-3.5 h-3.5" /> Cerrar Sesión
                </button>
              </div>
            </div>

            {adminTab === 'sales' ? (
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" /> Ventas Registradas y Recomendación de Compra por Proveedor
                </h2>
                
                <div className="space-y-4">
                  {adminSalesHistory.map(sale => (
                    <div key={sale.id} className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                      <div className="flex justify-between items-center text-xs">
                        <div>
                          <span className="font-mono font-bold text-purple-400">{sale.id}</span>
                          <span className="text-slate-400 ml-2">({sale.date})</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded font-bold ${sale.status === 'Aprobado' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}`}>
                          {sale.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 text-xs border-t border-slate-900">
                        <div>
                          <p className="text-slate-400">Cliente: <strong className="text-white">{sale.customerEmail}</strong></p>
                          <p className="text-slate-400">WhatsApp: <strong className="text-white">{sale.phone}</strong></p>
                          <p className="text-slate-400">Pago: <strong className="text-white">{sale.paymentMethod}</strong> - Ref: <strong className="text-cyan-300 font-mono">{sale.referenceNumber}</strong></p>
                        </div>
                        <div className="text-right">
                          <p className="text-slate-400">Total USD: <strong className="text-white font-mono">${sale.totalUsd.toFixed(2)}</strong></p>
                          <p className="text-slate-400">Total Bolívares: <strong className="text-cyan-300 font-mono">{new Intl.NumberFormat('es-VE', { maximumFractionDigits: 0 }).format(sale.totalBs)} Bs.</strong></p>
                        </div>
                      </div>

                      {/* ARBITRAJE DE COMPRA SUGERIDO PARA EL PRODUCTO VENDIDO */}
                      <div className="mt-3 pt-3 border-t border-slate-900 space-y-2">
                        <p className="text-[11px] font-bold text-purple-300 uppercase tracking-wider flex items-center gap-1">
                          <ArrowUpRight className="w-3.5 h-3.5" /> Recomendación de Adquisición (Key Arbitrage):
                        </p>
                        {sale.items.map((item, idx) => (
                          <div key={idx} className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                            <div>
                              <p className="font-bold text-white text-xs">{item.name}</p>
                              <div className="flex gap-3 text-[11px] text-slate-400 mt-0.5">
                                <span>G2A: <strong className="text-slate-200 font-mono">${item.g2aPriceUsd.toFixed(2)}</strong></span>
                                <span>Eneba: <strong className="text-slate-200 font-mono">${item.enebaPriceUsd.toFixed(2)}</strong></span>
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded border border-emerald-500/30 block">
                                  Comprar en {item.bestSupplier} (${item.supplierCostUsd.toFixed(2)})
                                </span>
                                <span className="text-[10px] text-purple-300">Margen Neto: +${item.profitMarginUsd.toFixed(2)} USD</span>
                              </div>
                              <a 
                                href={`https://www.${item.bestSupplier.toLowerCase()}.com`} 
                                target="_blank" 
                                rel="noreferrer"
                                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-[10px] px-3 py-1.5 rounded-lg shadow"
                              >
                                Comprar Key
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>

                      {sale.status !== 'Aprobado' && (
                        <button 
                          onClick={() => approveSaleAdmin(sale.id)}
                          className="mt-2 w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-1.5 rounded-lg text-xs transition"
                        >
                          Aprobar Pago y Liberar Keys
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-purple-400" /> Analíticas de Mercado & Brecha Cambiaria
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
                    <p className="text-xs text-slate-400">Tasa Oficial BCV</p>
                    <p className="text-xl font-bold font-mono text-white">
                      {bcvRate === null ? (bcvRateError ? 'No disponible' : 'Consultando...') : `${bcvRate.toFixed(2)} Bs.`}
                    </p>
                  </div>
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
                    <p className="text-xs text-slate-400">Tasa Binance P2P</p>
                    <p className="text-xl font-bold font-mono text-cyan-300">{binanceP2PRate.toFixed(2)} Bs.</p>
                  </div>
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
                    <p className="text-xs text-slate-400">Factor Cobertura Brecha</p>
                    <p className="text-xl font-bold font-mono text-purple-400">
                      {bsfCoverageFactor === null ? '—' : `+${((bsfCoverageFactor - 1) * 100).toFixed(1)}%`}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : activeTab === 'profile' ? (
          /* VISTA PERFIL / MIS KEYS */
          <div className="space-y-6 bg-slate-900/80 p-6 rounded-2xl border border-purple-900/50">
            <div className="flex justify-between items-center pb-4 border-b border-slate-800">
              <div>
                <h1 className="text-2xl font-black text-white flex items-center gap-2">
                  <Key className="w-6 h-6 text-purple-400" /> Mis Keys y Compras
                </h1>
                <p className="text-xs text-slate-400">Acceso passwordless guardado en tu dispositivo.</p>
              </div>
              <div className="bg-purple-950/60 p-3 rounded-xl border border-purple-800/40 text-right">
                <p className="text-[10px] text-purple-300 font-bold">Puntos Gamer Cash</p>
                <p className="text-lg font-black text-white font-mono">{gamerPoints} pts</p>
              </div>
            </div>

            {userOrders.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <Package className="w-12 h-12 text-slate-600 mx-auto" />
                <p className="text-slate-400 text-sm">Aún no has realizado ninguna compra.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {userOrders.map(order => (
                  <div key={order.id} className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-mono font-bold text-purple-400">{order.id} ({order.date})</span>
                      <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-500/30">
                        {order.status}
                      </span>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-slate-900">
                      {order.generatedKeys?.map((k, idx) => (
                        <div key={idx} className="bg-slate-900 p-3 rounded-lg flex justify-between items-center text-xs">
                          <div>
                            <p className="font-bold text-white">{k.title}</p>
                            <p className="text-[10px] text-cyan-400">{k.platform}</p>
                          </div>
                          <div className="bg-slate-950 px-3 py-1 rounded border border-purple-500/30 font-mono text-purple-300 font-bold select-all">
                            {k.key}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* VISTA INICIO Y CATÁLOGO DE PRODUCTOS */
          <>
            {/* HERO SLIDER */}
            <div className="relative rounded-2xl overflow-hidden border border-purple-500/20 shadow-2xl bg-slate-950 group">
              {heroItems.length > 0 && (
                <div className="relative h-64 sm:h-80 md:h-96 w-full overflow-hidden">
                  <img 
                    src={heroItems[currentSlide].bannerImage || heroItems[currentSlide].coverImage} 
                    alt={heroItems[currentSlide].title} 
                    className="w-full h-full object-cover object-center transform scale-105 group-hover:scale-100 transition-transform duration-700 filter brightness-90"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#070A10] via-[#070A10]/60 to-transparent" />

                  <div className="absolute bottom-0 left-0 p-6 md:p-10 space-y-3 max-w-xl">
                    <div className="flex items-center gap-2">
                      <span className="bg-purple-600 text-white text-[10px] font-black px-2.5 py-1 rounded-md tracking-wider uppercase shadow-md flex items-center gap-1">
                        <Flame className="w-3 h-3 fill-white" /> Destacado
                      </span>
                      <span className="bg-slate-900/80 text-cyan-400 border border-cyan-500/30 text-[10px] font-bold px-2 py-0.5 rounded-md">
                        {heroItems[currentSlide].variants[0].platform}
                      </span>
                    </div>

                    <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight line-clamp-2">
                      {heroItems[currentSlide].title}
                    </h1>

                    <div className="flex items-baseline gap-3 pt-1">
                      {/* PRECIO PRIMARIO DESTACADO EN BOLÍVARES */}
                      <span className="text-2xl sm:text-3xl font-black text-cyan-300 font-mono">
                        {calculateBs(heroItems[currentSlide].variants[0].priceUsd)} Bs.
                      </span>
                      {/* PRECIO SECUNDARIO EN USD */}
                      <span className="text-xs sm:text-sm text-slate-400 font-mono">
                        ≈ ${heroItems[currentSlide].variants[0].priceUsd.toFixed(2)} USD
                      </span>
                    </div>

                    <button 
                      onClick={() => addToCart(heroItems[currentSlide], heroItems[currentSlide].variants[0])}
                      className="bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm px-6 py-3 rounded-xl shadow-lg shadow-purple-600/30 flex items-center gap-2 transition transform active:scale-95"
                    >
                      <ShoppingCart className="w-4 h-4" /> Comprar Ahora
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* CATEGORÍAS */}
            <section className="space-y-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Filter className="w-4 h-4 text-purple-400" /> Categorías de Productos
              </h2>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                {CATEGORIES.map((cat) => {
                  const Icon = cat.icon;
                  const isSelected = selectedCategory === cat.name;
                  return (
                    <button
                      key={cat.name}
                      onClick={() => {
                        setSelectedCategory(cat.name);
                        setSelectedSubCategory('Todas');
                      }}
                      className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition duration-200 ${
                        isSelected 
                          ? 'bg-purple-950/60 border-purple-500 text-white shadow-lg shadow-purple-950/50' 
                          : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                      }`}
                    >
                      <div className={`p-2 rounded-lg bg-gradient-to-tr ${cat.color} text-white shadow-md`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-bold">{cat.name}</span>
                    </button>
                  );
                })}
              </div>

              {/* SUB-SECCIONES Y FILTROS ESPECÍFICOS PARA GIFT CARDS Y MONEDAS */}
              {selectedCategory === 'Gift Cards' && (
                <div className="pt-2 animate-fade-in">
                  <p className="text-xs font-bold text-purple-300 mb-2 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" /> Filtrar por Marca / Tienda:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {['Todas', 'Steam', 'PSN', 'Nintendo', 'Xbox', 'Apple & Google'].map((sub) => (
                      <button
                        key={sub}
                        onClick={() => setSelectedSubCategory(sub)}
                        className={`text-xs px-3 py-1.5 rounded-xl border font-bold transition-all ${
                          selectedSubCategory === sub
                            ? 'bg-gradient-to-r from-cyan-600 to-blue-600 border-cyan-400 text-white shadow-md'
                            : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                        }`}
                      >
                        {sub}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {selectedCategory === 'Monedas' && (
                <div className="pt-2 animate-fade-in">
                  <p className="text-xs font-bold text-amber-300 mb-2 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Filtrar por Juego / Moneda:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {['Todas', 'V-Bucks (Fortnite)', 'Free Fire', 'Valorant (VP)', 'Roblox (Robux)', 'FC Points', 'League of Legends', 'COD Points'].map((sub) => (
                      <button
                        key={sub}
                        onClick={() => setSelectedSubCategory(sub)}
                        className={`text-xs px-3 py-1.5 rounded-xl border font-bold transition-all ${
                          selectedSubCategory === sub
                            ? 'bg-gradient-to-r from-amber-500 to-orange-600 border-amber-400 text-white shadow-md'
                            : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                        }`}
                      >
                        {sub}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {selectedCategory === 'Suscripciones' && (
                <div className="pt-2 animate-fade-in">
                  <p className="text-xs font-bold text-indigo-300 mb-2 flex items-center gap-1.5">
                    <Play className="w-3.5 h-3.5 text-indigo-400" /> Filtrar por Servicio / Consola:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {['Todas', 'PlayStation Plus', 'Xbox Game Pass', 'Discord Nitro', 'EA Play', 'Anime & Streaming'].map((sub) => (
                      <button
                        key={sub}
                        onClick={() => setSelectedSubCategory(sub)}
                        className={`text-xs px-3 py-1.5 rounded-xl border font-bold transition-all ${
                          selectedSubCategory === sub
                            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 border-indigo-400 text-white shadow-md'
                            : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                        }`}
                      >
                        {sub}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* GRID CATÁLOGO CON ANALÍTICAS INTERACTIVAS EN CADA PRODUCTO */}
            <section className="space-y-4">
              <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                <Flame className="w-5 h-5 text-purple-400" /> Catálogo Gamer ({filteredProducts.length})
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredProducts.map((game) => {
                  const activeVariantId = selectedVariants[game.id] || game.variants[0].id;
                  const activeVariant = game.variants.find(v => v.id === activeVariantId) || game.variants[0];
                  const history = game.priceHistory30d || { lowest: activeVariant.priceUsd * 0.95, highest: activeVariant.priceUsd * 1.15, isLowest30d: false };

                  return (
                    <div 
                      key={game.id}
                      id={`product-${game.id}`}
                      className="scroll-mt-24 bg-slate-900/90 border border-slate-800 hover:border-purple-500/50 rounded-2xl overflow-hidden shadow-lg transition flex flex-col justify-between"
                    >
                      <div>
                        <div className="relative h-48 overflow-hidden bg-slate-950">
                          <img 
                            src={game.coverImage} 
                            alt={game.title} 
                            className="w-full h-full object-cover group-hover:scale-105 transition"
                          />

                          {/* BADGE ANALÍTICO: PRECIO MÁS BAJO EN 30 DÍAS */}
                          {history.isLowest30d && (
                            <span className="absolute top-3 left-3 bg-emerald-600/95 backdrop-blur-md text-white font-extrabold text-[10px] px-2 py-0.5 rounded-md shadow-md flex items-center gap-1">
                              <TrendingDown className="w-3 h-3" /> ¡Más bajo en 30 días!
                            </span>
                          )}

                          <div className="absolute bottom-2 left-3 flex gap-2">
                            <span className="text-[10px] font-semibold text-cyan-300 bg-slate-950/80 px-2 py-0.5 rounded border border-cyan-500/20">
                              {activeVariant.region}
                            </span>
                            <span className="text-[10px] font-semibold text-emerald-400 bg-slate-950/80 px-2 py-0.5 rounded border border-emerald-500/20">
                              Stock: {activeVariant.stock}
                            </span>
                          </div>
                        </div>

                        <div className="p-4 space-y-3">
                          <h3 className="font-bold text-white text-base line-clamp-2">{game.title}</h3>

                          {/* SECCIÓN DE ANALÍTICAS INTERACTIVAS DEL PRECIO (MÍN / MÁX EN 30 DÍAS) */}
                          <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800/80 space-y-1 text-xs">
                            <div className="flex justify-between items-center text-[10px] text-slate-400">
                              <span className="flex items-center gap-1"><BarChart3 className="w-3 h-3 text-purple-400" /> Rango 30 días (API Sync):</span>
                              <span className="font-mono text-emerald-400 font-bold">${history.lowest.toFixed(2)} - ${history.highest.toFixed(2)}</span>
                            </div>
                            <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden flex">
                              <div className="bg-gradient-to-r from-emerald-500 via-cyan-400 to-purple-500 h-full w-full" />
                            </div>
                          </div>

                          <div className="pt-1 space-y-1">
                            <span className="text-[10px] uppercase font-bold text-slate-400">Variante:</span>
                            <div className="flex flex-wrap gap-1.5">
                              {game.variants.map((v) => (
                                <button
                                  key={v.id}
                                  onClick={() => handleVariantSelect(game.id, v.id)}
                                  className={`text-[11px] font-bold px-2 py-0.5 rounded-lg border transition ${
                                    v.id === activeVariant.id
                                      ? 'bg-purple-600 border-purple-400 text-white'
                                      : 'bg-slate-950 border-slate-800 text-slate-400'
                                  }`}
                                >
                                  {v.platform}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="p-4 pt-2 border-t border-slate-800/60 flex items-center justify-between">
                        <div>
                          {/* PRECIO PRIMARIO EN BOLÍVARES (Bs.) */}
                          <span className="text-xl font-black text-cyan-300 font-mono block">
                            {calculateBs(activeVariant.priceUsd)} Bs.
                          </span>
                          {/* PRECIO SECUNDARIO EN DÓLARES ($) */}
                          <p className="text-[11px] text-slate-400 font-mono font-semibold">
                            ≈ ${activeVariant.priceUsd.toFixed(2)} USD
                          </p>
                        </div>

                        <button 
                          onClick={() => addToCart(game, activeVariant)}
                          className="bg-purple-600 hover:bg-purple-500 text-white px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-md shadow-purple-950"
                        >
                          <ShoppingCart className="w-4 h-4" /> Añadir
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}

      </main>

      {/* MODAL OCULTO LOGIN ADMINISTRADOR (/admin) */}
      {showAdminLoginModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#090D16] border border-purple-900/60 rounded-2xl w-full max-w-sm p-6 space-y-4 relative">
            <button onClick={() => setShowAdminLoginModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Lock className="w-5 h-5 text-purple-400" /> Acceso Administrativo
              </h2>
              <p className="text-xs text-slate-400">Introduce las credenciales de gestión.</p>
            </div>

            <form onSubmit={handleAdminLogin} className="space-y-3">
              <div>
                <label className="block text-[11px] text-slate-300 mb-1">Email Admin</label>
                <input 
                  type="email" 
                  required
                  placeholder="admin@lacasitagamer.com"
                  value={adminLoginForm.email}
                  onChange={(e) => setAdminLoginForm({...adminLoginForm, email: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-300 mb-1">Contraseña</label>
                <input 
                  type="password" 
                  required
                  placeholder="••••••"
                  value={adminLoginForm.password}
                  onChange={(e) => setAdminLoginForm({...adminLoginForm, password: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white focus:border-purple-500 focus:outline-none"
                />
              </div>

              <button type="submit" className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-2 rounded-xl text-xs transition">
                Iniciar Sesión Admin
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CHECKOUT CON PUNTOS GAMER CASH */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#090D16] border border-purple-900/50 rounded-2xl w-full max-w-lg p-6 space-y-4 relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => setIsCheckoutOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
                <ShieldCheck className="w-6 h-6 text-emerald-400" /> Checkout Sin Contraseña
              </h2>
              <p className="text-xs text-slate-400">Ingresa tus datos y reporta tu Pago Móvil.</p>
            </div>

            <form onSubmit={handleProcessOrder} className="space-y-4">
              <div className="space-y-3 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
                <h3 className="text-xs font-bold text-purple-300 uppercase tracking-wider">1. Datos del Cliente</h3>
                <div>
                  <label className="block text-[11px] text-slate-300 mb-1">Email (Recepción de Keys)</label>
                  <input 
                    type="email" 
                    required
                    placeholder="tu_email@gmail.com"
                    value={checkoutForm.email}
                    onChange={(e) => setCheckoutForm({...checkoutForm, email: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white focus:border-purple-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-300 mb-1">WhatsApp</label>
                  <input 
                    type="tel" 
                    required
                    placeholder="0412-1234567"
                    value={checkoutForm.phone}
                    onChange={(e) => setCheckoutForm({...checkoutForm, phone: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white focus:border-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* OPCIÓN DESCUENTO POR PUNTOS GAMER CASH */}
              {gamerPoints > 0 && (
                <div className="bg-purple-950/40 border border-purple-800/40 p-3 rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <p className="font-bold text-purple-200">Usar Puntos Gamer Cash ({gamerPoints} pts)</p>
                    <p className="text-[10px] text-slate-400">Descuento de ${pointsUsdDiscount.toFixed(2)} USD</p>
                  </div>
                  <input 
                    type="checkbox"
                    checked={usePointsInCheckout}
                    onChange={(e) => setUsePointsInCheckout(e.target.checked)}
                    className="w-4 h-4 accent-purple-600 rounded cursor-pointer"
                  />
                </div>
              )}

              <div className="space-y-3 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
                <h3 className="text-xs font-bold text-purple-300 uppercase tracking-wider">2. Pago Móvil / Binance</h3>
                <div>
                  <label className="block text-[11px] text-slate-300 mb-1">Número de Referencia</label>
                  <input 
                    type="text" 
                    required
                    placeholder="Ej. 7849102"
                    value={checkoutForm.referenceNumber}
                    onChange={(e) => setCheckoutForm({...checkoutForm, referenceNumber: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white focus:border-purple-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="p-3 bg-purple-950/40 border border-purple-800/40 rounded-xl space-y-1 text-xs">
                <div className="flex justify-between text-slate-300">
                  <span>Total Final USD:</span>
                  <span className="font-mono font-bold">${finalCheckoutUsd.toFixed(2)} USD</span>
                </div>
                <div className="flex justify-between text-cyan-300 font-bold">
                  <span>Monto Pago Móvil:</span>
                  <span className="font-mono">{calculateBs(finalCheckoutUsd)} Bs.</span>
                </div>
              </div>

              <button 
                type="submit" 
                disabled={isProcessingOrder}
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold py-3 rounded-xl text-sm transition"
              >
                {isProcessingOrder ? 'Verificando...' : 'Confirmar y Recibir Keys'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* DRAWER CARRITO DE COMPRAS */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-md bg-[#090D16] border-l border-purple-900/40 h-full flex flex-col justify-between p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-purple-400" /> Carrito Gamer
              </h2>
              <button onClick={() => setIsCartOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-4">
              {cart.map(item => (
                <div key={item.cartItemId} className="flex gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                  <img src={item.coverImage} alt={item.title} className="w-14 h-14 object-cover rounded-lg" />
                  <div className="flex-1 min-w-0 text-xs">
                    <h4 className="font-bold text-white line-clamp-1">{item.title}</h4>
                    <p className="text-purple-300">{item.platform}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="font-mono font-bold text-white">${(item.priceUsd * item.quantity).toFixed(2)}</span>
                      <div className="flex items-center gap-2 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                        <button onClick={() => updateQuantity(item.cartItemId, -1)} className="text-slate-400 hover:text-white">-</button>
                        <span className="text-white font-bold">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.cartItemId, 1)} className="text-slate-400 hover:text-white">+</button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {cart.length > 0 && (
              <div className="pt-4 border-t border-slate-800 space-y-3">
                <div className="flex justify-between text-base font-black text-white">
                  <span>Total a Pagar</span>
                  <span className="font-mono text-cyan-300">{calculateBs(totalCartUsd)} Bs.</span>
                </div>
                <button 
                  onClick={() => { setIsCartOpen(false); setIsCheckoutOpen(true); }}
                  className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-xl text-sm transition"
                >
                  Procesar Pago Rápidamente
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#090D16]/95 backdrop-blur-md border-t border-purple-900/30 px-6 py-2">
        <div className="flex justify-between items-center">
          <button onClick={() => setActiveTab('home')} className={`flex flex-col items-center gap-1 ${activeTab === 'home' ? 'text-purple-400' : 'text-slate-500'}`}>
            <Home className="w-5 h-5" />
            <span className="text-[10px]">Inicio</span>
          </button>
          <button onClick={() => setIsCartOpen(true)} className="flex flex-col items-center gap-1 text-slate-500">
            <ShoppingBag className="w-5 h-5" />
            <span className="text-[10px]">Carrito</span>
          </button>
          <button onClick={() => setActiveTab('profile')} className={`flex flex-col items-center gap-1 ${activeTab === 'profile' ? 'text-purple-400' : 'text-slate-500'}`}>
            <User className="w-5 h-5" />
            <span className="text-[10px]">Mis Keys</span>
          </button>
        </div>
      </nav>

      <RecentActivityNotification onProductClick={handleActivityProductClick} />

    </div>
  );
}