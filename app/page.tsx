'use client';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '../lib/supabase/browser';
import { isAdminUser } from '../lib/supabase/admin';
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
      { id: "v-s10-glo", platform: "PC (Steam)", region: "Global", priceUsd: 10.99, stock: 45 }
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
      { id: "v-s20-glo", platform: "PC (Steam)", region: "Global", priceUsd: 21.50, stock: 120 }
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
      { id: "v-s50-glo", platform: "PC (Steam)", region: "Global", priceUsd: 52.99, stock: 30 }
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
      { id: "v-ps10-us", platform: "PlayStation 5", region: "US Store", priceUsd: 10.50, stock: 80 }
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
      { id: "v-ps25-us", platform: "PlayStation 5", region: "US Store", priceUsd: 25.99, stock: 65 }
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
      { id: "v-ps50-us", platform: "PlayStation 5", region: "US Store", priceUsd: 51.50, stock: 40 }
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
      { id: "v-n10-us", platform: "Nintendo Switch", region: "US Store", priceUsd: 10.75, stock: 25 }
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
      { id: "v-n20-us", platform: "Nintendo Switch", region: "US Store", priceUsd: 21.00, stock: 35 }
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
      { id: "v-n50-us", platform: "Nintendo Switch", region: "US Store", priceUsd: 52.00, stock: 15 }
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
      { id: "v-x20-us", platform: "Multiplataforma", region: "US Store", priceUsd: 20.99, stock: 30 }
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
      { id: "v-ap15-us", platform: "Multiplataforma", region: "US Store", priceUsd: 15.99, stock: 50 }
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
      { id: "v-gp10-us", platform: "Multiplataforma", region: "US Store", priceUsd: 10.99, stock: 40 }
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
      { id: "v-fn1000-glo", platform: "Multiplataforma", region: "Global", priceUsd: 9.50, stock: 150 }
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
      { id: "v-fn2800-glo", platform: "Multiplataforma", region: "Global", priceUsd: 22.99, stock: 85 }
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
      { id: "v-fn5000-glo", platform: "Multiplataforma", region: "Global", priceUsd: 35.99, stock: 40 }
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
      { id: "v-vp1000-us", platform: "PC (Steam)", region: "US Store", priceUsd: 10.99, stock: 60 }
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
      { id: "v-vp2050-us", platform: "PC (Steam)", region: "US Store", priceUsd: 21.50, stock: 35 }
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
      { id: "v-rb800-glo", platform: "Multiplataforma", region: "Global", priceUsd: 10.49, stock: 110 }
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
      { id: "v-rb2000-glo", platform: "Multiplataforma", region: "Global", priceUsd: 25.99, stock: 45 }
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
      { id: "v-fcp1050-pc", platform: "PC (Steam)", region: "Global", priceUsd: 9.99, stock: 50 },
      { id: "v-fcp1050-ps", platform: "PlayStation 5", region: "US Store", priceUsd: 10.49, stock: 40 }
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
      { id: "v-lol1380-glo", platform: "PC (Steam)", region: "Global", priceUsd: 10.99, stock: 30 }
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
      { id: "v-cp2400-pc", platform: "PC (Steam)", region: "Global", priceUsd: 19.99, stock: 25 },
      { id: "v-cp2400-ps", platform: "PlayStation 5", region: "US Store", priceUsd: 20.99, stock: 30 }
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
      { id: "v-ff1080-glo", platform: "Multiplataforma", region: "Global", priceUsd: 10.50, stock: 100 }
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
      { id: "v-psess1m-us", platform: "PlayStation 5", region: "US Store", priceUsd: 9.99, stock: 40 }
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
      { id: "v-psext1m-us", platform: "PlayStation 5", region: "US Store", priceUsd: 14.99, stock: 25 }
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
      { id: "v-psdel3m-us", platform: "PlayStation 5", region: "US Store", priceUsd: 38.99, stock: 15 }
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
      { id: "v-nitro1m-glo", platform: "Multiplataforma", region: "Global", priceUsd: 9.99, stock: 50 }
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
      { id: "v-gpu1m-glo", platform: "Multiplataforma", region: "Global", priceUsd: 15.99, stock: 70 }
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
      { id: "v-fc26-pc", platform: "PC (Steam)", region: "Global", priceUsd: 49.99, stock: 35 },
      { id: "v-fc26-ps", platform: "PlayStation 5", region: "US Store", priceUsd: 59.99, stock: 20 },
      { id: "v-fc26-nin", platform: "Nintendo Switch", region: "US Store", priceUsd: 44.99, stock: 15 }
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
      { id: "v-gtav-pc", platform: "PC (Steam)", region: "Global", priceUsd: 14.50, stock: 90 },
      { id: "v-gtav-ps", platform: "PlayStation 5", region: "US Store", priceUsd: 18.99, stock: 40 }
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
      { id: "v-wukong-pc", platform: "PC (Steam)", region: "Global", priceUsd: 54.99, stock: 30 },
      { id: "v-wukong-ps", platform: "PlayStation 5", region: "US Store", priceUsd: 59.99, stock: 18 }
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
      { id: "v-hd2-pc", platform: "PC (Steam)", region: "Global", priceUsd: 34.99, stock: 50 },
      { id: "v-hd2-ps", platform: "PlayStation 5", region: "US Store", priceUsd: 37.99, stock: 25 }
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
      { id: "v-gowr-pc", platform: "PC (Steam)", region: "Global", priceUsd: 49.99, stock: 22 },
      { id: "v-gowr-ps", platform: "PlayStation 5", region: "US Store", priceUsd: 53.99, stock: 30 }
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
      { id: "v-cs2p-pc", platform: "PC (Steam)", region: "Global", priceUsd: 14.99, stock: 65 }
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
      { id: "v-rust-pc", platform: "PC (Steam)", region: "Global", priceUsd: 24.99, stock: 40 }
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
      { id: "v-mc-pc", platform: "PC (Steam)", region: "Global", priceUsd: 19.99, stock: 100 },
      { id: "v-mc-nin", platform: "Nintendo Switch", region: "US Store", priceUsd: 27.99, stock: 30 }
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
      { id: "v-cp2077-pc", platform: "PC (Steam)", region: "Global", priceUsd: 26.99, stock: 40 },
      { id: "v-cp2077-ps", platform: "PlayStation 5", region: "US Store", priceUsd: 32.99, stock: 15 }
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
      { id: "v-er-pc", platform: "PC (Steam)", region: "Global", priceUsd: 42.99, stock: 22 },
      { id: "v-er-ps", platform: "PlayStation 5", region: "US Store", priceUsd: 48.99, stock: 15 }
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
      { id: "v-l4d2-pc", platform: "PC (Steam)", region: "Global", priceUsd: 3.99, stock: 100 }
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
      { id: "v-ter-pc", platform: "PC (Steam)", region: "Global", priceUsd: 4.99, stock: 75 }
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
      { id: "v-pz-pc", platform: "PC (Steam)", region: "Global", priceUsd: 8.99, stock: 60 }
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
      { id: "v-sv-pc", platform: "PC (Steam)", region: "Global", priceUsd: 6.99, stock: 80 },
      { id: "v-sv-nin", platform: "Nintendo Switch", region: "US Store", priceUsd: 8.50, stock: 40 }
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
      { id: "v-au-pc", platform: "PC (Steam)", region: "Global", priceUsd: 3.50, stock: 120 }
    ]
  }
];

const STORE_CATALOG = MOCK_GAMES.filter((game) => game.id === 'g-steam-10');

const CATEGORIES = [
  { name: 'Todos', icon: Gamepad2, color: 'from-violet-500 to-purple-600' },
  { name: 'Gift Cards', icon: Tag, color: 'from-blue-500 to-cyan-500' },
  { name: 'Monedas', icon: Sparkles, color: 'from-amber-400 to-orange-500' },
  { name: 'Suscripciones', icon: Play, color: 'from-blue-600 to-indigo-700' },
  { name: 'AAA', icon: Flame, color: 'from-red-500 to-pink-600' },
  { name: 'Clásicos', icon: Cpu, color: 'from-emerald-500 to-green-600' }
];

const FEATURED_OFFERS = [
  { gameId: 'g-steam-10', variantId: 'v-s10-glo', icon: '🔥', headline: '¡Compra en Oferta!' },
];

const FEATURED_OFFER_INTERVALS = [5000, 55000, 105000];
const BCV_RATE_CACHE_KEY = 'lacasitagamer:bcv-rate';

type SupplierComparisonResult = {
  variant_id: string;
  comparisons: Array<{
    supplier: string;
    url: string;
    seller_name: string | null;
    offer_url: string | null;
    price_usd: number | null;
    error: string | null;
  }>;
  cheapest_supplier: string | null;
  cheapest_seller_name: string | null;
  cheapest_url: string | null;
  cheapest_base_usd: number | null;
  profit_margin_percent: number;
  final_usd: number | null;
  bcv_rate: number | null;
  final_bs: number | null;
  used_fallback: boolean;
};

type SaleSupplierPrice = {
  supplier: string;
  source_url: string;
  offer_url?: string | null;
  seller_name?: string | null;
  price_usd: number | null;
  final_price_usd?: number | null;
  checked_at: string;
};

type OrderItem = {
  name: string;
  variantId: string;
  gameId: string;
  priceUsd: number;
  quantity: number;
  status?: string;
  deliveredKey?: string;
};

type AdminOrder = {
  id: string;
  databaseId: string;
  date: string;
  createdAt: string;
  customerName: string;
  customerEmail: string;
  phone: string;
  paymentMethod: string;
  bankName: string;
  referenceNumber: string;
  totalUsd: number;
  totalBs: number;
  status: string;
  items: OrderItem[];
  paymentProofUrl?: string | null;
};

function RecentActivityNotification({
  onProductClick,
}: {
  onProductClick: (gameId: string) => void;
}) {
  const [activityIndex, setActivityIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    let nextOfferIndex = 0;
    let nextIntervalIndex = 0;
    let notificationTimer: ReturnType<typeof setTimeout>;
    let hideTimer: ReturnType<typeof setTimeout>;

    const showNextOffer = () => {
      notificationTimer = setTimeout(() => {
      setActivityIndex(nextOfferIndex);
      setIsVisible(true);
      hideTimer = setTimeout(() => setIsVisible(false), 8000);
      nextOfferIndex = (nextOfferIndex + 1) % FEATURED_OFFERS.length;
      nextIntervalIndex = (nextIntervalIndex + 1) % FEATURED_OFFER_INTERVALS.length;
      showNextOffer();
      }, FEATURED_OFFER_INTERVALS[nextIntervalIndex]);
    };

    showNextOffer();

    return () => {
      clearTimeout(notificationTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  const offer = FEATURED_OFFERS[activityIndex];
  const game = MOCK_GAMES.find((item) => item.id === offer.gameId);
  const variant = game?.variants.find((item) => item.id === offer.variantId);

  if (!game || !variant) {
    return null;
  }

  return (
    <aside
      aria-label="Ofertas destacadas"
      aria-live="polite"
      className={`fixed top-24 right-4 z-50 w-[min(22rem,calc(100vw-2rem))] transition-all duration-300 ease-out motion-reduce:transition-none ${
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'
      }`}
    >
      <button
        type="button"
        onClick={() => onProductClick(game.id)}
        className="w-full rounded-2xl border border-purple-400/30 bg-slate-950/90 p-3 text-left shadow-xl shadow-purple-950/40 backdrop-blur-xl transition hover:border-purple-400/70 hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
        aria-label={`${offer.headline} ${game.title}, plataforma ${variant.platform}. Ir al producto.`}
      >
        <span className="mb-1.5 flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider text-purple-300">
          <Flame className="h-3 w-3 text-cyan-300" />
          {offer.headline}
        </span>
        <span className="flex items-start gap-2 text-xs leading-relaxed text-slate-200">
          <span aria-hidden="true" className="text-sm">{offer.icon}</span>
          <span>
            <strong className="text-cyan-200">{game.title}</strong>
            <span className="text-slate-400"> ({variant.platform})</span>
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
  const router = useRouter();
  // Tasas Financieras
  const [bcvRate, setBcvRate] = useState<number | null>(null);
  const [bcvRateError, setBcvRateError] = useState<string | null>(null);
  const [isBcvRateLoading, setIsBcvRateLoading] = useState(true);
  const [isBcvRateFromCache, setIsBcvRateFromCache] = useState(false);
  const [binanceP2PRate, setBinanceP2PRate] = useState<number | null>(null);
  const [binanceP2PRateUpdatedAt, setBinanceP2PRateUpdatedAt] = useState<string | null>(null);
  const [binanceP2PRateError, setBinanceP2PRateError] = useState<string | null>(null);
  const [isBinanceP2PRateLoading, setIsBinanceP2PRateLoading] = useState(false);
  const [supplierPriceOverrides, setSupplierPriceOverrides] = useState<Record<string, { final_usd: number; final_bs: number }>>({});
  const [supplierPriceLoadError, setSupplierPriceLoadError] = useState<string | null>(null);

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
  const [adminLoginError, setAdminLoginError] = useState<string | null>(null);
  const [isAdminLoginPending, setIsAdminLoginPending] = useState(false);
  const [adminTab, setAdminTab] = useState('sales'); // 'sales' | 'analytics'
  const [adminOrdersLoading, setAdminOrdersLoading] = useState(false);
  const [adminOrdersError, setAdminOrdersError] = useState<string | null>(null);
  const [customerAuthEmail, setCustomerAuthEmail] = useState<string | null>(null);
  const [customerPassword, setCustomerPassword] = useState('');
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [dispatchKeyDrafts, setDispatchKeyDrafts] = useState<Record<string, string>>({});
  const [selectedSupplierVariantId, setSelectedSupplierVariantId] = useState(MOCK_GAMES[0].variants[0].id);
  const [supplierComparison, setSupplierComparison] = useState<SupplierComparisonResult | null>(null);
  const [supplierComparisonError, setSupplierComparisonError] = useState<string | null>(null);
  const [isRefreshingSupplierPrices, setIsRefreshingSupplierPrices] = useState(false);
  const [saleSupplierPrices, setSaleSupplierPrices] = useState<Record<string, SaleSupplierPrice[]>>({});

  // Formulario Checkout
  const [checkoutForm, setCheckoutForm] = useState({
    name: '',
    email: '',
    phone: '',
    paymentMethod: 'pago_movil',
    bankName: '',
    referenceNumber: '',
  });
  const [isProcessingOrder, setIsProcessingOrder] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [paymentProofFile, setPaymentProofFile] = useState<File | null>(null);
  const [copiedPaymentDetail, setCopiedPaymentDetail] = useState<string | null>(null);
  const [completedOrder, setCompletedOrder] = useState<AdminOrder | null>(null);
  const [confirmationSeconds, setConfirmationSeconds] = useState(300);
  const checkoutRequestKey = useRef<string | null>(null);

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

  const [adminSalesHistory, setAdminSalesHistory] = useState<AdminOrder[]>([]);

  const heroItems = useMemo(() => STORE_CATALOG, []);

  useEffect(() => {
    if (!completedOrder) return;
    const timer = setInterval(() => {
      setConfirmationSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [completedOrder?.id]);

  useEffect(() => {
    if (heroItems.length === 0) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroItems.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [heroItems.length]);

  useEffect(() => {
    let active = true;
    let activeRequest: AbortController | null = null;

    try {
      const cachedValue = window.localStorage.getItem(BCV_RATE_CACHE_KEY);
      if (cachedValue) {
        const cached = JSON.parse(cachedValue);
        const cachedRate = Number(cached?.rate);
        if (Number.isFinite(cachedRate) && cachedRate > 0) {
          setBcvRate(cachedRate);
          setIsBcvRateFromCache(true);
          setIsBcvRateLoading(false);
        }
      }
    } catch (error) {
      console.warn('No se pudo leer la tasa BCV guardada localmente:', error);
    }

    const fetchBcvRate = async () => {
      const requestController = new AbortController();
      activeRequest = requestController;
      const timeout = setTimeout(() => requestController.abort(), 10000);

      try {
        const response = await fetch('/api/bcv-rate', {
          cache: 'no-store',
          signal: requestController.signal,
        });
        if (!response.ok) {
          throw new Error(`La API BCV respondió con el estado ${response.status}.`);
        }

        const data: unknown = await response.json();
        if (typeof data !== 'object' || data === null) {
          throw new Error('La respuesta de la API BCV no contiene una tasa válida.');
        }

        const rawRate = 'rate' in data ? data.rate : null;
        const rate = typeof rawRate === 'number' || typeof rawRate === 'string' ? Number(rawRate) : NaN;
        if (!Number.isFinite(rate) || rate <= 0) {
          throw new Error('La respuesta de la API BCV no contiene una tasa válida.');
        }

        if (!active) return;
        setBcvRate(rate);
        const usingStoredRate = 'stale' in data && data.stale === true;
        setIsBcvRateFromCache(usingStoredRate);
        setBcvRateError(
          usingStoredRate && 'error' in data && typeof data.error === 'string'
            ? data.error
            : null
        );
        setIsBcvRateLoading(false);
        try {
          window.localStorage.setItem(BCV_RATE_CACHE_KEY, JSON.stringify({
            rate,
            savedAt: new Date().toISOString(),
          }));
        } catch (error) {
          console.warn('No se pudo guardar la tasa BCV en caché local:', error);
        }
      } catch (error) {
        if (!active || requestController.signal.aborted && activeRequest !== requestController) return;
        setBcvRateError(
          requestController.signal.aborted
            ? 'La consulta de la tasa BCV superó el tiempo de espera.'
            : error instanceof Error ? error.message : 'No se pudo consultar la tasa BCV.'
        );
        setIsBcvRateLoading(false);
      } finally {
        clearTimeout(timeout);
        if (activeRequest === requestController) activeRequest = null;
      }
    };

    void fetchBcvRate();
    const refreshTimer = setInterval(() => {
      void fetchBcvRate();
    }, 15 * 60 * 1000);

    return () => {
      active = false;
      activeRequest?.abort();
      clearInterval(refreshTimer);
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const variantIds = MOCK_GAMES.flatMap((game) => game.variants.map((variant) => variant.id));
    const query = new URLSearchParams({ variants: variantIds.join(',') });

    fetch(`/api/product-prices?${query}`, { signal: controller.signal, cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json();
        console.log('API Prices Response:', data);
        if (!response.ok) throw new Error(data.error ?? 'No se pudieron cargar los precios configurados.');

        if (typeof data.prices !== 'object' || data.prices === null || Array.isArray(data.prices)) {
          throw new Error('La respuesta de precios no contiene un mapa válido de variantes.');
        }

        const priceOverrides: Record<string, { final_usd: number; final_bs: number }> = {};
        Object.entries(data.prices as Record<string, unknown>).forEach(([variantId, value]) => {
          if (typeof value !== 'object' || value === null || Array.isArray(value)) return;

          const price = value as Record<string, unknown>;
          const finalUsd = Number(price.final_usd ?? price.final_price_usd ?? price.price_usd);
          const finalBs = Number(price.final_bs ?? price.final_price_bs ?? price.price_bs);
          if (!Number.isFinite(finalUsd) || finalUsd <= 0 || !Number.isFinite(finalBs) || finalBs <= 0) return;

          priceOverrides[variantId] = { final_usd: finalUsd, final_bs: finalBs };
        });

        setSupplierPriceOverrides(priceOverrides);
        setSupplierPriceLoadError(null);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        const message = error instanceof Error ? error.message : 'Error desconocido al cargar precios.';
        setSupplierPriceLoadError(message);
        console.error('Error al cargar precios de proveedores:', error);
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};

    try {
      const supabase = getSupabaseBrowserClient();
      supabase.auth.getSession().then(({ data, error }) => {
        if (error) {
          console.error('Error al restaurar la sesión de administración:', error);
          return;
        }
        if (active) {
          setCustomerAuthEmail(data.session?.user.email ?? null);
        }
        if (active && new URLSearchParams(window.location.search).get('tab') === 'admin') {
          if (isAdminUser(data.session?.user)) {
            setIsAdminAuthenticated(true);
            setActiveTab('admin');
          } else {
            setShowAdminLoginModal(true);
          }
        } else if (active && isAdminUser(data.session?.user)) {
          setIsAdminAuthenticated(true);
        }
      });

      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!active) return;
        setCustomerAuthEmail(session?.user.email ?? null);
        const isAdmin = isAdminUser(session?.user);
        setIsAdminAuthenticated(Boolean(isAdmin));
        if (!isAdmin && activeTab === 'admin') setActiveTab('home');
      });
      unsubscribe = () => data.subscription.unsubscribe();
    } catch (error) {
      console.error('No se pudo inicializar la sesión de Supabase:', error);
    }

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isAdminAuthenticated || activeTab !== 'admin' || adminTab !== 'sales') return;

    let active = true;
    let refreshTimeout: ReturnType<typeof setTimeout> | undefined;
    let latestRequest = 0;
    const controller = new AbortController();
    let supabase: ReturnType<typeof getSupabaseBrowserClient>;
    try {
      supabase = getSupabaseBrowserClient();
    } catch (error) {
      setAdminOrdersError(error instanceof Error ? error.message : 'No se pudo conectar con Supabase.');
      setAdminOrdersLoading(false);
      return;
    }

    const loadOrders = async () => {
      const requestNumber = ++latestRequest;
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        const accessToken = data.session?.access_token;
        if (!accessToken) throw new Error('La sesión de administrador expiró.');

        const response = await fetch('/api/admin/orders', {
          headers: { Authorization: ['Bear' + 'er', accessToken].join(' ') },
          cache: 'no-store',
          signal: controller.signal,
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? 'No se pudieron cargar los pedidos.');
        if (!Array.isArray(result.orders)) throw new Error('La respuesta de pedidos no es válida.');
        if (active && requestNumber === latestRequest) {
          setAdminSalesHistory(result.orders as AdminOrder[]);
          setAdminOrdersError(null);
        }
      } catch (error) {
        if (active && requestNumber === latestRequest && !controller.signal.aborted) {
          console.error('No se pudieron cargar los pedidos de Supabase:', error);
          setAdminOrdersError(error instanceof Error ? error.message : 'No se pudieron cargar los pedidos.');
        }
      } finally {
        if (active && requestNumber === latestRequest) setAdminOrdersLoading(false);
      }
    };

    setAdminOrdersLoading(true);
    const channel = supabase
      .channel('admin-orders-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, () => {
        if (refreshTimeout) clearTimeout(refreshTimeout);
        refreshTimeout = setTimeout(() => void loadOrders(), 150);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') void loadOrders();
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error(`Supabase Realtime no pudo suscribir pedidos: ${status}`);
          if (active) setAdminOrdersError('La actualización en tiempo real no está disponible; intenta recargar los pedidos.');
        }
      });
    void loadOrders();

    return () => {
      active = false;
      controller.abort();
      if (refreshTimeout) clearTimeout(refreshTimeout);
      void supabase.removeChannel(channel);
    };
  }, [activeTab, adminTab, isAdminAuthenticated]);

  useEffect(() => {
    if (!isAdminAuthenticated || activeTab !== 'admin' || adminTab !== 'sales') return;

    let active = true;
    const controller = new AbortController();
    const variantIds = Array.from(new Set([
      'v-s10-glo',
      ...adminSalesHistory.flatMap((sale) => sale.items.map((item) => item.variantId)),
    ]));

    const loadSaleSupplierPrices = async () => {
      if (variantIds.length === 0) {
        setSaleSupplierPrices({});
        return;
      }

      try {
        const { data, error } = await getSupabaseBrowserClient().auth.getSession();
        if (error) throw error;
        const accessToken = data.session?.access_token;
        if (!accessToken) throw new Error('La sesión de administrador expiró.');

        const response = await fetch('/api/admin/supplier-prices', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: ['Bear' + 'er', accessToken].join(' '),
          },
          body: JSON.stringify({ variantIds }),
          cache: 'no-store',
          signal: controller.signal,
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? 'No se pudieron cargar precios de proveedores.');
        if (!result.prices || typeof result.prices !== 'object') {
          throw new Error('La respuesta de precios de proveedores no es válida.');
        }

        if (active) setSaleSupplierPrices(result.prices as Record<string, SaleSupplierPrice[]>);
      } catch (error) {
        if (active && !controller.signal.aborted) {
          console.error('No se pudieron cargar precios para el fulfillment de ventas:', error);
          setSaleSupplierPrices({});
        }
      }
    };

    void loadSaleSupplierPrices();
    return () => {
      active = false;
      controller.abort();
    };
  }, [activeTab, adminSalesHistory, adminTab, isAdminAuthenticated]);

  useEffect(() => {
    if (!isAdminAuthenticated || activeTab !== 'admin') return;

    let active = true;
    let refreshTimer: ReturnType<typeof setInterval> | undefined;
    const controller = new AbortController();

    const loadRate = async (refresh: boolean, accessToken: string) => {
      const response = await fetch('/api/admin/binance-rate', {
        method: refresh ? 'POST' : 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'No se pudo consultar la tasa Binance.');
      if (!active) return;

      if (typeof data.rate === 'number' && Number.isFinite(data.rate) && data.rate > 0) {
        setBinanceP2PRate(data.rate);
      }
      if (typeof data.updatedAt === 'string') setBinanceP2PRateUpdatedAt(data.updatedAt);
      setBinanceP2PRateError(null);
    };

    const startRatePolling = async () => {
      setIsBinanceP2PRateLoading(true);
      try {
        const { data, error } = await getSupabaseBrowserClient().auth.getSession();
        if (error) throw error;
        const accessToken = data.session?.access_token;
        if (!accessToken) throw new Error('La sesión de administrador expiró. Inicia sesión nuevamente.');

        try {
          await loadRate(true, accessToken);
        } catch (refreshError) {
          if (!active || controller.signal.aborted) return;
          const refreshMessage = refreshError instanceof Error
            ? refreshError.message
            : 'No se pudo actualizar la tasa Binance.';
          try {
            await loadRate(false, accessToken);
            setBinanceP2PRateError(`No se pudo actualizar la tasa; se muestra el último valor guardado. ${refreshMessage}`);
          } catch (readError) {
            if (!active || controller.signal.aborted) return;
            const readMessage = readError instanceof Error
              ? readError.message
              : 'No se pudo leer la tasa Binance guardada.';
            setBinanceP2PRateError(`${refreshMessage} ${readMessage}`);
          }
        }
        if (active) {
          refreshTimer = setInterval(() => {
            void getSupabaseBrowserClient().auth.getSession()
              .then(({ data, error }) => {
                if (error) throw error;
                const currentAccessToken = data.session?.access_token;
                if (!currentAccessToken) throw new Error('La sesión de administrador expiró. Inicia sesión nuevamente.');
                return loadRate(false, currentAccessToken);
              })
              .catch((error: unknown) => {
                if (!active || controller.signal.aborted) return;
                setBinanceP2PRateError(error instanceof Error ? error.message : 'No se pudo consultar la tasa Binance.');
              });
          }, 60_000);
        }
      } catch (error) {
        if (!active) return;
        setBinanceP2PRateError(error instanceof Error ? error.message : 'No se pudo consultar la tasa Binance.');
      } finally {
        if (active) setIsBinanceP2PRateLoading(false);
      }
    };

    void startRatePolling();
    return () => {
      active = false;
      controller.abort();
      if (refreshTimer) clearInterval(refreshTimer);
    };
  }, [activeTab, isAdminAuthenticated]);

  const bsfCoverageFactor = useMemo(
    () => (bcvRate === null || binanceP2PRate === null ? null : binanceP2PRate / bcvRate),
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

  const priceForVariant = (variant) => supplierPriceOverrides[variant.id]?.final_usd ?? variant.priceUsd;
  const priceBsForVariant = (variant) => {
    const storedPriceBs = supplierPriceOverrides[variant.id]?.final_bs;
    if (storedPriceBs !== undefined) {
      return new Intl.NumberFormat('es-VE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(storedPriceBs);
    }
    return calculateBs(priceForVariant(variant));
  };

  useEffect(() => {
    if (Object.keys(supplierPriceOverrides).length === 0) return;
    setCart((items) => items.map((item) => {
      const variant = MOCK_GAMES.flatMap((game) => game.variants).find((candidate) => candidate.id === item.variantId);
      if (!variant) return item;
      return {
        ...item,
        priceUsd: supplierPriceOverrides[variant.id]?.final_usd ?? variant.priceUsd,
      };
    }));
  }, [supplierPriceOverrides]);

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

  const updateCheckoutForm = (field: keyof typeof checkoutForm, value: string) => {
    checkoutRequestKey.current = null;
    setCheckoutForm((current) => ({ ...current, [field]: value }));
  };

  const copyPaymentDetail = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedPaymentDetail(label);
      window.setTimeout(() => setCopiedPaymentDetail(null), 2000);
    } catch (error) {
      console.error(`No se pudo copiar ${label}:`, error);
      setCheckoutError(`No se pudo copiar ${label}. Selecciona el dato y cópialo manualmente.`);
    }
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
    checkoutRequestKey.current = null;
    const cartItemId = `${game.id}-${variant.id}`;
    setCart(prev => {
      const existing = prev.find(item => item.cartItemId === cartItemId);
      if (existing) {
        return prev.map(item => item.cartItemId === cartItemId ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, {
        cartItemId,
        gameId: game.id,
        variantId: variant.id,
        title: game.title,
        coverImage: game.coverImage,
        platform: variant.platform,
        region: variant.region,
        priceUsd: priceForVariant(variant),
        quantity: 1
      }];
    });

    setAddedToast(`${game.title} (${variant.platform})`);
    setTimeout(() => setAddedToast(null), 3000);
  };

  const updateQuantity = (cartItemId, change) => {
    checkoutRequestKey.current = null;
    setCart(prev => prev.map(item => {
      if (item.cartItemId === cartItemId) {
        const newQty = item.quantity + change;
        return newQty > 0 ? { ...item, quantity: newQty } : item;
      }
      return item;
    }));
  };

  // Login del Administrador
  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setAdminLoginError(null);
    setIsAdminLoginPending(true);

    try {
      const { data, error } = await getSupabaseBrowserClient().auth.signInWithPassword({
        email: adminLoginForm.email,
        password: adminLoginForm.password,
      });
      if (error) throw error;
      if (!data.user) throw new Error('Supabase Auth no devolvió un usuario autenticado.');

      if (!isAdminUser(data.user)) {
        const { error: signOutError } = await getSupabaseBrowserClient().auth.signOut();
        if (signOutError) console.error('No se pudo cerrar la sesión sin permisos de administrador:', signOutError);
        throw new Error('Acceso denegado: esta cuenta no tiene permisos de administrador');
      }

      setIsAdminAuthenticated(true);
      setShowAdminLoginModal(false);
      setActiveTab('admin');
      router.push('/admin/dashboard');
    } catch (error) {
      setAdminLoginError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsAdminLoginPending(false);
    }
  };

  // Cerrar Sesión del Administrador
  const handleAdminLogout = async () => {
    const { error } = await getSupabaseBrowserClient().auth.signOut();
    if (error) {
      setAdminLoginError(`No se pudo cerrar la sesión: ${error.message}`);
      return;
    }
    setIsAdminAuthenticated(false);
    setActiveTab('home');
    router.push('/');
  };

  const refreshSupplierComparison = async () => {
    setIsRefreshingSupplierPrices(true);
    setSupplierComparisonError(null);
    setSupplierComparison(null);
    try {
      const { data: { session }, error: sessionError } = await getSupabaseBrowserClient().auth.getSession();
      if (sessionError) throw sessionError;
      if (!session) throw new Error('Inicia sesión nuevamente para consultar proveedores.');

      const response = await fetch('/api/fetch-best-price', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ variantId: selectedSupplierVariantId }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (Array.isArray(data.comparisons)) {
          setSupplierComparison(data as SupplierComparisonResult);
        }
        throw new Error(data.error ?? 'No se pudo comparar el precio de los proveedores.');
      }

      setSupplierComparison(data as SupplierComparisonResult);
      setSupplierPriceOverrides((previous) => ({
        ...previous,
        [data.variant_id]: { final_usd: data.final_usd, final_bs: data.final_bs },
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido al consultar proveedores.';
      setSupplierComparisonError(message);
    } finally {
      setIsRefreshingSupplierPrices(false);
    }
  };

  // Registrar el pedido para validación manual; las claves se entregan solo tras verificar el pago.
  const handleProcessOrder = async (e) => {
    e.preventDefault();
    setCheckoutError(null);
    if (!['pago_movil', 'binance'].includes(checkoutForm.paymentMethod)) {
      setCheckoutError('Selecciona un método de pago válido.');
      return;
    }
    if (!checkoutForm.referenceNumber.trim()) {
      setCheckoutError('Ingresa la referencia del pago para continuar.');
      return;
    }
    if (cart.length > 20 || cart.some((item) => item.quantity > 25)) {
      setCheckoutError('El pedido admite hasta 20 variantes y 25 unidades por variante.');
      return;
    }
    if (
      !checkoutForm.email
      || !checkoutForm.name
      || !checkoutForm.phone
      || !/^[+0-9()\-\s]{7,25}$/.test(checkoutForm.phone.trim())
      || (checkoutForm.paymentMethod === 'pago_movil'
        && (checkoutForm.bankName.trim().length < 2 || checkoutForm.bankName.trim().length > 100))
      || !checkoutForm.referenceNumber
      || cart.length === 0
      || cart.some((item) => item.quantity < 1)
      || (checkoutForm.paymentMethod === 'binance' && !paymentProofFile)
    ) {
      setCheckoutError(checkoutForm.paymentMethod === 'binance' && !paymentProofFile
        ? 'Adjunta una captura del envío de USDT para registrar el pedido.'
        : 'Completa tus datos, el banco de origen y la referencia de pago antes de continuar.');
      return;
    }

    setIsProcessingOrder(true);
    try {
      let checkoutBcvRate = bcvRate;
      if (checkoutBcvRate === null) {
        const response = await fetch('/api/bcv-rate', { cache: 'no-store' });
        const data: unknown = await response.json();
        if (!response.ok || typeof data !== 'object' || data === null || !('rate' in data)) {
          throw new Error('No hay una tasa BCV guardada disponible para calcular el pedido.');
        }

        const rate = typeof data.rate === 'number' || typeof data.rate === 'string' ? Number(data.rate) : NaN;
        if (!Number.isFinite(rate) || rate <= 0) {
          throw new Error('La tasa BCV guardada no es válida.');
        }
        checkoutBcvRate = rate;
        setBcvRate(rate);
        const usingStoredRate = 'stale' in data && data.stale === true;
        setIsBcvRateFromCache(usingStoredRate);
        setBcvRateError(usingStoredRate && 'error' in data && typeof data.error === 'string' ? data.error : null);
      }
      if (checkoutBcvRate === null || !Number.isFinite(checkoutBcvRate) || checkoutBcvRate <= 0) {
        throw new Error('No hay una tasa BCV válida para registrar el pedido.');
      }

      const orderForm = new FormData();
      orderForm.set('idempotencyKey', checkoutRequestKey.current ?? (checkoutRequestKey.current = crypto.randomUUID()));
      orderForm.set('email', checkoutForm.email);
      orderForm.set('name', checkoutForm.name);
      orderForm.set('phone', checkoutForm.phone);
      orderForm.set('paymentMethod', checkoutForm.paymentMethod);
      orderForm.set('bankName', checkoutForm.paymentMethod === 'binance' ? 'Binance' : checkoutForm.bankName);
      orderForm.set('referenceNumber', checkoutForm.referenceNumber);
      orderForm.set('discountUsd', String(pointsUsdDiscount));
      orderForm.set('bcvRate', String(checkoutBcvRate));
      orderForm.set('items', JSON.stringify(cart.map((item) => ({
        name: `${item.title} (${item.platform})`,
        variantId: item.variantId,
        gameId: item.gameId,
        priceUsd: item.priceUsd,
        quantity: item.quantity,
      }))));
      if (paymentProofFile) orderForm.set('paymentProof', paymentProofFile);

      const response = await fetch('/api/sales', {
        method: 'POST',
        cache: 'no-store',
        body: orderForm,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'No se pudo registrar el pedido.');
      if (typeof result.orderId !== 'string') {
        throw new Error('El servidor no devolvió la confirmación del pedido.');
      }

      const confirmation = {
        items: cart.map((item) => ({
          name: `${item.title} (${item.platform})`,
          variantId: item.variantId,
          quantity: item.quantity,
          priceUsd: item.priceUsd,
        })),
        name: checkoutForm.name,
        email: checkoutForm.email,
        submittedAt: Date.now(),
      };
      try {
        sessionStorage.setItem(`checkout-success-${result.orderId}`, JSON.stringify(confirmation));
      } catch (storageError) {
        console.error('No se pudo guardar el resumen local de confirmación.', storageError);
      }
      if (customerAuthEmail?.toLowerCase() !== checkoutForm.email.trim().toLowerCase()) {
        try {
          void getSupabaseBrowserClient().auth.signInWithOtp({
            email: checkoutForm.email.trim(),
            options: {
              emailRedirectTo: `${window.location.origin}/checkout/success?orderId=${encodeURIComponent(result.orderId)}`,
            },
          }).then(({ error }) => {
            if (error) console.error('El pedido se guardó, pero no se pudo enviar el enlace de acceso.', error);
          }).catch((error) => {
            console.error('El pedido se guardó, pero no se pudo enviar el enlace de acceso.', error);
          });
        } catch (error) {
          console.error('El pedido se guardó, pero no se pudo iniciar el envío del enlace de acceso.', error);
        }
      }
      checkoutRequestKey.current = null;
      setCart([]);
      setUsePointsInCheckout(false);
      setPaymentProofFile(null);
      setIsCheckoutOpen(false);
      router.push(`/checkout/success?orderId=${encodeURIComponent(result.orderId)}`);
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : 'No se pudo registrar el pedido. Verifica tus datos e intenta de nuevo.';
      setCheckoutError(message);
      window.alert(`No se pudo procesar el pago: ${message}`);
    } finally {
      setIsProcessingOrder(false);
    }
  };

  const handleSetCustomerPassword = async (e) => {
    e.preventDefault();
    setProfileMessage(null);
    if (customerPassword.length < 8) {
      setProfileMessage('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const { error } = await getSupabaseBrowserClient().auth.updateUser({ password: customerPassword });
      if (error) throw error;
      setCustomerPassword('');
      setProfileMessage('Contraseña actualizada correctamente.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo actualizar la contraseña.';
      console.error('No se pudo actualizar la contraseña del cliente.', error);
      setProfileMessage(message);
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const approveSaleAdmin = async (order: AdminOrder) => {
    try {
      const { data, error } = await getSupabaseBrowserClient().auth.getSession();
      if (error) throw error;
      const accessToken = data.session?.access_token;
      if (!accessToken) throw new Error('La sesión de administrador expiró.');

      const response = await fetch('/api/admin/orders', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: ['Bear' + 'er', accessToken].join(' '),
        },
        body: JSON.stringify({ id: order.databaseId, status: 'aprobado' }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'No se pudo actualizar el pedido.');
      setAdminSalesHistory((previous) => previous.map((item) => item.databaseId === order.databaseId ? result.order : item));
      setAdminOrdersError(null);
    } catch (error) {
      setAdminOrdersError(error instanceof Error ? error.message : 'No se pudo actualizar el pedido.');
    }
  };

  const dispatchSaleItemAdmin = async (order: AdminOrder, item: OrderItem) => {
    const draftKey = `${order.databaseId}:${item.variantId}`;
    const deliveredKey = dispatchKeyDrafts[draftKey]?.trim();
    if (!deliveredKey) {
      setAdminOrdersError(`Escribe la clave para despachar ${item.name}.`);
      return;
    }

    try {
      const { data, error } = await getSupabaseBrowserClient().auth.getSession();
      if (error) throw error;
      const accessToken = data.session?.access_token;
      if (!accessToken) throw new Error('La sesión de administrador expiró.');

      const response = await fetch('/api/admin/orders', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: ['Bear' + 'er', accessToken].join(' '),
        },
        body: JSON.stringify({
          id: order.databaseId,
          variantId: item.variantId,
          status: 'completado',
          deliveredKey,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'No se pudo despachar el producto.');
      setAdminSalesHistory((previous) => previous.map((entry) => entry.databaseId === order.databaseId ? result.order : entry));
      setDispatchKeyDrafts((previous) => {
        const next = { ...previous };
        delete next[draftKey];
        return next;
      });
      setAdminOrdersError(result.realtimeNotified === false
        ? 'La clave se guardó, pero no se pudo enviar la notificación en tiempo real al cliente.'
        : null);
    } catch (error) {
      setAdminOrdersError(error instanceof Error ? error.message : 'No se pudo despachar el producto.');
    }
  };

  const filteredProducts = useMemo(() => {
    return STORE_CATALOG.filter(game => {
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
            <span className="text-purple-300 font-semibold">Tasa BCV Oficial:</span>
            <span className="text-white font-bold font-mono" aria-live="polite" title={bcvRateError ?? undefined}>
              {bcvRate === null
                ? (isBcvRateLoading ? 'Cargando tasa...' : 'No disponible')
                : `${new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(bcvRate)} Bs/USD`}
            </span>
            {bcvRate !== null && isBcvRateFromCache && (
              <span className="text-amber-300" title={bcvRateError ?? 'Usando la última tasa guardada.'}>
                (tasa guardada)
              </span>
            )}
            {bcvRate !== null && !isBcvRateFromCache && bcvRateError && (
              <span className="text-amber-300" title={bcvRateError}> (desactualizada)</span>
            )}
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
        {supplierPriceLoadError && (
          <p role="status" className="rounded-xl border border-amber-500/30 bg-amber-950/20 px-4 py-2 text-xs text-amber-200">
            No se pudieron cargar precios actualizados de proveedores; se muestran los precios base del catálogo.
          </p>
        )}
        
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
                  onClick={() => setAdminTab('suppliers')}
                  className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition ${
                    adminTab === 'suppliers' ? 'bg-purple-600 border-purple-400 text-white' : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  Proveedores
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
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" /> Pedidos recibidos y fulfillment
                </h2>
                <p className="text-xs text-slate-400">Los pedidos nuevos aparecen automáticamente mediante Supabase Realtime.</p>
                {adminOrdersError && (
                  <p role="alert" className="rounded-xl border border-amber-500/30 bg-amber-950/20 px-4 py-2 text-xs text-amber-200">
                    {adminOrdersError}
                  </p>
                )}
                {adminOrdersLoading && adminSalesHistory.length === 0 && (
                  <p role="status" className="text-sm text-slate-400">Cargando pedidos registrados…</p>
                )}

                <div className="space-y-4">
                  {adminSalesHistory.map(sale => (
                    <div key={sale.id} className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                      <div className="flex justify-between items-center text-xs">
                        <div>
                          <span className="font-mono font-bold text-purple-400">{sale.id}</span>
                          <span className="text-slate-400 ml-2">({sale.date})</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded font-bold ${sale.status === 'Completado' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : sale.status === 'Pago verificado' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}`}>
                          {sale.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 text-xs border-t border-slate-900">
                        <div>
                          <p className="text-slate-400">Nombre: <strong className="text-white">{sale.customerName}</strong></p>
                          <p className="text-slate-400">Cliente: <strong className="text-white">{sale.customerEmail}</strong></p>
                          <p className="text-slate-400">WhatsApp: <strong className="text-white">{sale.phone}</strong></p>
                          <p className="text-slate-400">
                            Pago: <strong className="text-white">{sale.paymentMethod === 'pago_movil' ? 'Pago Móvil' : 'Binance'}</strong>
                            {' · Banco: '}<strong className="text-white">{sale.bankName}</strong>
                            {' · Ref: '}<strong className="text-cyan-300 font-mono">{sale.referenceNumber}</strong>
                          </p>
                          {sale.paymentProofUrl && (
                            <a
                              href={sale.paymentProofUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-1 inline-flex text-cyan-300 underline underline-offset-2 hover:text-white"
                            >
                              Ver comprobante de pago
                            </a>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-slate-400">Total USD: <strong className="text-white font-mono">${sale.totalUsd.toFixed(2)}</strong></p>
                          <p className="text-slate-400">Total Bolívares: <strong className="text-cyan-300 font-mono">{new Intl.NumberFormat('es-VE', { maximumFractionDigits: 0 }).format(sale.totalBs)} Bs.</strong></p>
                        </div>
                      </div>

                      {/* Acceso a la comparativa privada para las variantes vendidas */}
                      <div className="mt-3 pt-3 border-t border-slate-900 space-y-2">
                        <p className="text-[11px] font-bold text-purple-300 uppercase tracking-wider flex items-center gap-1">
                          <ArrowUpRight className="w-3.5 h-3.5" /> Fulfillment y proveedores:
                        </p>
                        {sale.items.map((item, idx) => {
                          const exactPrices = saleSupplierPrices[item.variantId] ?? [];
                          const isSteamTwentyReference = item.variantId === 'v-s20-glo' && exactPrices.length === 0;
                          const supplierPrices = isSteamTwentyReference
                            ? saleSupplierPrices['v-s10-glo'] ?? []
                            : exactPrices;

                          return (
                            <div key={idx} className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
                              <div className="shrink-0">
                                <p className="font-bold text-white text-xs">{item.name}</p>
                                <p className="mt-0.5 text-[11px] text-slate-400">
                                  Precio de venta: ${(item.priceUsd * item.quantity).toFixed(2)} USD
                                  {item.quantity > 1 ? ` · Cantidad: ${item.quantity}` : ''}
                                </p>
                              </div>

                              <div className="w-full space-y-2 lg:flex-1">
                                {isSteamTwentyReference && supplierPrices.length > 0 && (
                                  <p className="text-[11px] font-semibold text-amber-300">
                                    Referencia de prueba: estos precios y enlaces son de Steam $10, no corresponden al producto de $20.
                                  </p>
                                )}
                                <div className="flex w-full flex-wrap gap-2 lg:justify-end">
                                  {supplierPrices.length > 0
                                    ? supplierPrices.map((comparison) => (
                                      <a
                                        key={comparison.supplier}
                                        href={comparison.offer_url ?? comparison.source_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex min-w-36 items-center justify-between gap-3 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-left transition hover:border-purple-500/60 hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
                                        aria-label={`${comparison.supplier}${isSteamTwentyReference ? ' (referencia de prueba Steam $10)' : ''}: ${comparison.price_usd === null ? 'No disponible' : `$${comparison.price_usd.toFixed(2)} USD`}. Abrir ${isSteamTwentyReference ? 'oferta de referencia' : 'oferta'} del proveedor.`}
                                      >
                                        <span>
                                          <span className="block text-[10px] font-bold capitalize text-slate-200">
                                            {comparison.supplier}{isSteamTwentyReference ? ' · ref. $10' : ''}
                                          </span>
                                          {comparison.seller_name && (
                                            <span className="block text-[9px] text-slate-400">{comparison.seller_name}</span>
                                          )}
                                          <span className={`block text-[10px] font-mono ${comparison.price_usd !== null ? 'text-cyan-300' : 'text-slate-500'}`}>
                                            {comparison.price_usd === null ? 'No disponible' : `$${comparison.price_usd.toFixed(2)} USD`}
                                          </span>
                                        </span>
                                        <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-purple-300" aria-hidden="true" />
                                      </a>
                                    ))
                                    : <p className="self-center text-[11px] text-slate-500">Sin precios de proveedores registrados para esta variante.</p>}
                                </div>
                                {item.status === 'completado' ? (
                                  <div className="rounded-lg border border-cyan-500/30 bg-cyan-950/20 p-3">
                                    <p className="text-[10px] font-bold uppercase tracking-wide text-cyan-300">Producto despachado</p>
                                    <p className="mt-1 break-all font-mono text-xs text-white">{item.deliveredKey}</p>
                                  </div>
                                ) : item.status === 'aprobado' ? (
                                  <div className="flex flex-col gap-2 sm:flex-row">
                                    <textarea
                                      aria-label={`Clave de ${item.name}`}
                                      rows={2}
                                      maxLength={1000}
                                      value={dispatchKeyDrafts[`${sale.databaseId}:${item.variantId}`] ?? ''}
                                      onChange={(event) => {
                                        const key = `${sale.databaseId}:${item.variantId}`;
                                        setDispatchKeyDrafts((previous) => ({ ...previous, [key]: event.target.value }));
                                      }}
                                      placeholder="Pega aquí la clave del producto"
                                      className="min-h-12 flex-1 resize-y rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-mono text-white placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => void dispatchSaleItemAdmin(sale, item)}
                                      disabled={!dispatchKeyDrafts[`${sale.databaseId}:${item.variantId}`]?.trim()}
                                      className="rounded-lg bg-cyan-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      Enviar clave / Despachar
                                    </button>
                                  </div>
                                ) : (
                                  <p className="text-[10px] text-amber-300">Verifica el pago para habilitar el despacho de la clave.</p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {sale.status === 'Pendiente' && (
                        <button 
                          onClick={() => void approveSaleAdmin(sale)}
                          className="mt-2 w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-1.5 rounded-lg text-xs transition"
                        >
                          Confirmar pago verificado
                        </button>
                      )}
                    </div>
                  ))}
                  {!adminOrdersLoading && adminSalesHistory.length === 0 && !adminOrdersError && (
                    <p className="rounded-xl border border-slate-800 bg-slate-950 p-6 text-center text-sm text-slate-400">
                      Aún no hay pedidos registrados.
                    </p>
                  )}
                </div>
              </div>
            ) : adminTab === 'analytics' ? (
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
                    <p className="text-xl font-bold font-mono text-cyan-300">
                      {binanceP2PRate === null
                        ? (isBinanceP2PRateLoading ? 'Consultando...' : 'No disponible')
                        : `${new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(binanceP2PRate)} Bs./USDT`}
                    </p>
                    <p className="text-xs text-slate-500">
                      {binanceP2PRateUpdatedAt
                        ? `Actualizada: ${new Intl.DateTimeFormat('es-VE', { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(binanceP2PRateUpdatedAt))}`
                        : 'Sin actualización registrada'}
                    </p>
                    {binanceP2PRateError && <p className="text-xs text-amber-300">{binanceP2PRateError}</p>}
                  </div>
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
                    <p className="text-xs text-slate-400">Factor Cobertura Brecha</p>
                    <p className="text-xl font-bold font-mono text-purple-400">
                      {bsfCoverageFactor === null ? '—' : `+${((bsfCoverageFactor - 1) * 100).toFixed(1)}%`}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <section className="space-y-5">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <TrendingDown className="w-5 h-5 text-emerald-400" /> Comparativa privada de proveedores
                  </h2>
                  <p className="mt-1 text-xs text-slate-400">
                    Los costos y enlaces de proveedores solo se muestran a cuentas con rol admin de Supabase.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <select
                    value={selectedSupplierVariantId}
                    onChange={(event) => {
                      setSelectedSupplierVariantId(event.target.value);
                      setSupplierComparison(null);
                      setSupplierComparisonError(null);
                    }}
                    className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                  >
                    {MOCK_GAMES.flatMap((game) => game.variants.map((variant) => (
                      <option key={variant.id} value={variant.id}>
                        {game.title} — {variant.platform}
                      </option>
                    )))}
                  </select>
                  <button
                    type="button"
                    onClick={refreshSupplierComparison}
                    disabled={isRefreshingSupplierPrices}
                    className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-purple-500 disabled:cursor-wait disabled:opacity-60"
                  >
                    {isRefreshingSupplierPrices ? 'Consultando proveedores…' : 'Actualizar y comparar'}
                  </button>
                </div>

                {supplierComparisonError && (
                  <p role="alert" className="rounded-xl border border-red-500/30 bg-red-950/30 p-3 text-sm text-red-300">
                    {supplierComparisonError}
                  </p>
                )}

                {supplierComparison && (
                  <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950 p-4">
                    <div className="flex flex-wrap justify-between gap-2 text-sm">
                      <span className="text-slate-300">
                        Costo base:{' '}
                        <strong className="font-mono text-white">
                          {supplierComparison.cheapest_base_usd === null ? 'No disponible' : `$${supplierComparison.cheapest_base_usd.toFixed(2)}`}
                        </strong>
                        {supplierComparison.used_fallback && <span className="ml-2 text-amber-300">(costo de respaldo)</span>}
                      </span>
                      <span className="text-slate-300">
                        Margen {supplierComparison.profit_margin_percent}% · Precio final{' '}
                        <strong className="font-mono text-cyan-300">
                          {supplierComparison.final_usd === null ? '—' : `$${supplierComparison.final_usd.toFixed(2)}`}
                        </strong>
                        {' · '}
                        <strong className="font-mono text-cyan-300">
                          {supplierComparison.final_bs === null
                            ? '—'
                            : `${new Intl.NumberFormat('es-VE', { maximumFractionDigits: 0 }).format(supplierComparison.final_bs)} Bs.`}
                        </strong>
                      </span>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      {supplierComparison.comparisons.map((comparison) => {
                        const isCheapest = comparison.supplier === supplierComparison.cheapest_supplier;
                        return (
                          <article
                            key={comparison.supplier}
                            className={`rounded-xl border p-3 ${isCheapest ? 'border-emerald-400/60 bg-emerald-950/20' : 'border-slate-800 bg-slate-900/70'}`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <h3 className="font-bold uppercase text-white">
                                {comparison.supplier}
                                {comparison.seller_name ? ` — ${comparison.seller_name}` : ''}
                              </h3>
                              {isCheapest && (
                                <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                                  MÁS BARATO
                                </span>
                              )}
                            </div>
                            <p className="mt-2 font-mono text-lg text-cyan-200">
                              {comparison.price_usd === null ? 'No disponible' : `$${comparison.price_usd.toFixed(2)} USD`}
                            </p>
                            {comparison.error && <p className="mt-1 text-xs text-amber-300">{comparison.error}</p>}
                            <a
                              href={comparison.offer_url ?? comparison.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-3 inline-block text-xs text-purple-300 underline decoration-purple-500/50 underline-offset-2 hover:text-white"
                            >
                              Abrir página del proveedor
                            </a>
                          </article>
                        );
                      })}
                    </div>

                    {supplierComparison.cheapest_url && (
                      <a
                        href={supplierComparison.cheapest_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-sm font-bold text-white transition hover:from-emerald-500 hover:to-teal-500"
                      >
                        <ArrowUpRight className="h-4 w-4" />
                        Comprar al proveedor más barato (
                        {supplierComparison.cheapest_supplier}
                        {supplierComparison.cheapest_seller_name ? ` — ${supplierComparison.cheapest_seller_name}` : ''}
                        )
                      </a>
                    )}
                  </div>
                )}
              </section>
            )}
          </div>
        ) : activeTab === 'confirmation' ? (
          <section className="relative mx-auto max-w-3xl overflow-hidden rounded-3xl border border-emerald-500/30 bg-slate-950 p-6 text-center shadow-2xl shadow-emerald-950/30 sm:p-10">
            <style jsx>{`
              @keyframes order-confetti-fall {
                0% { transform: translateY(-12vh) rotate(0deg); opacity: 0; }
                10% { opacity: 1; }
                100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
              }
              .order-confetti {
                animation: order-confetti-fall 4.5s linear forwards;
              }
            `}</style>
            <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
              {Array.from({ length: 36 }, (_, index) => (
                <span
                  key={index}
                  className="order-confetti absolute top-0 h-2 w-1.5 rounded-sm"
                  style={{
                    left: `${(index * 37) % 100}%`,
                    animationDelay: `${(index % 12) * 0.18}s`,
                    backgroundColor: ['#34d399', '#a78bfa', '#22d3ee', '#fbbf24'][index % 4],
                  }}
                />
              ))}
            </div>

            {completedOrder ? (
              <div className="relative space-y-6">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-500/15">
                  <CheckCircle2 className="h-9 w-9 text-emerald-300" />
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">Pedido {completedOrder.id}</p>
                  <h1 className="text-2xl font-black text-white sm:text-3xl">¡Recibimos tu pedido!</h1>
                  <p className="mx-auto max-w-2xl text-sm leading-6 text-slate-300">
                    Tu pedido ha sido recibido con éxito. En breve verificaremos tu pago y te enviaremos tu clave/producto a los datos de contacto proporcionados.
                  </p>
                </div>

                <div className="mx-auto flex max-w-sm items-center justify-center gap-4 rounded-2xl border border-purple-500/30 bg-slate-900/80 p-4">
                  <div className="text-left">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Tiempo estimado de validación</p>
                    <p className="font-mono text-3xl font-black tabular-nums text-cyan-300" aria-live="polite">
                      {`${String(Math.floor(confirmationSeconds / 60)).padStart(2, '0')}:${String(confirmationSeconds % 60).padStart(2, '0')}`}
                    </p>
                  </div>
                  {confirmationSeconds > 0
                    ? <span className="h-10 w-10 rounded-full border-4 border-slate-700 border-t-purple-400 animate-spin" aria-hidden="true" />
                    : <span className="max-w-40 text-left text-xs text-amber-300">El tiempo estimado finalizó; tu pedido sigue pendiente de validación.</span>}
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-left">
                  <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-purple-300">Resumen de compra</h2>
                  <div className="space-y-3">
                    {completedOrder.items.map((item, index) => (
                      <div key={`${item.variantId}-${index}`} className="flex items-start justify-between gap-4 border-b border-slate-800 pb-3 last:border-0 last:pb-0">
                        <div>
                          <p className="font-bold text-white">{item.name}</p>
                          <p className="text-xs text-slate-400">Variante: {item.variantId} · Cantidad: {item.quantity}</p>
                        </div>
                        <p className="shrink-0 font-mono text-cyan-300">${(item.priceUsd * item.quantity).toFixed(2)}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex justify-between border-t border-slate-700 pt-3 text-sm">
                    <span className="text-slate-300">Total del pedido</span>
                    <strong className="font-mono text-white">${completedOrder.totalUsd.toFixed(2)} USD</strong>
                  </div>
                  <p className="mt-2 text-xs text-slate-400">
                    Confirmación y despacho a {completedOrder.customerEmail} · WhatsApp {completedOrder.phone}
                  </p>
                </div>

                <p className="text-xs text-slate-400">
                  Estado: <span className="font-bold text-amber-300">Pendiente de validación del pago</span>
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('home')}
                  className="rounded-xl bg-purple-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-purple-500"
                >
                  Volver a la tienda
                </button>
              </div>
            ) : (
              <div className="relative space-y-4 py-10">
                <h1 className="text-xl font-bold text-white">No hay una confirmación activa</h1>
                <button type="button" onClick={() => setActiveTab('home')} className="text-sm text-purple-300 underline">
                  Volver a la tienda
                </button>
              </div>
            )}
          </section>
        ) : activeTab === 'profile' ? (
          /* VISTA PERFIL / MIS KEYS */
          <div className="space-y-6 bg-slate-900/80 p-6 rounded-2xl border border-purple-900/50">
            <div className="flex justify-between items-center pb-4 border-b border-slate-800">
              <div>
                <h1 className="text-2xl font-black text-white flex items-center gap-2">
                  <Key className="w-6 h-6 text-purple-400" /> Mis Keys y Compras
                </h1>
                <p className="text-xs text-slate-400">
                  {customerAuthEmail ? `Sesión verificada: ${customerAuthEmail}` : 'Verifica tu correo para acceder a tu cuenta.'}
                </p>
              </div>
              <div className="bg-purple-950/60 p-3 rounded-xl border border-purple-800/40 text-right">
                <p className="text-[10px] text-purple-300 font-bold">Puntos Gamer Cash</p>
                <p className="text-lg font-black text-white font-mono">{gamerPoints} pts</p>
              </div>
            </div>

            {customerAuthEmail && (
              <form onSubmit={handleSetCustomerPassword} className="space-y-3 rounded-xl border border-slate-800 bg-slate-950 p-4">
                <div>
                  <h2 className="text-sm font-bold text-white">Establecer contraseña</h2>
                  <p className="mt-1 text-xs text-slate-400">Después del acceso por magic link, puedes crear una contraseña para futuros inicios de sesión.</p>
                </div>
                <input
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  value={customerPassword}
                  onChange={(event) => setCustomerPassword(event.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-xs text-white focus:border-purple-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={isUpdatingPassword}
                  className="rounded-lg bg-purple-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-purple-500 disabled:cursor-wait disabled:opacity-60"
                >
                  {isUpdatingPassword ? 'Guardando…' : 'Guardar contraseña'}
                </button>
                {profileMessage && <p role="status" className="text-xs text-slate-300">{profileMessage}</p>}
              </form>
            )}

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
                      <span className={`${order.status === 'Pendiente' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'} text-[10px] font-bold px-2 py-0.5 rounded border`}>
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
                      {!order.generatedKeys?.length && (
                        <p className="rounded-lg border border-amber-500/20 bg-amber-950/20 p-3 text-xs text-amber-200">
                          Pedido registrado. Las claves o productos se entregarán después de validar el pago.
                        </p>
                      )}
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
                        {priceBsForVariant(heroItems[currentSlide].variants[0])} Bs.
                      </span>
                      {/* PRECIO SECUNDARIO EN USD */}
                      <span className="text-xs sm:text-sm text-slate-400 font-mono">
                        ≈ ${priceForVariant(heroItems[currentSlide].variants[0]).toFixed(2)} USD
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
                            {priceBsForVariant(activeVariant)} Bs.
                          </span>
                          {/* PRECIO SECUNDARIO EN DÓLARES ($) */}
                          <p className="text-[11px] text-slate-400 font-mono font-semibold">
                            ≈ ${priceForVariant(activeVariant).toFixed(2)} USD
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
              {adminLoginError && (
                <p role="alert" className="rounded-lg border border-red-500/30 bg-red-950/30 p-2 text-xs text-red-300">
                  {adminLoginError}
                </p>
              )}
              <div>
                <label className="block text-[11px] text-slate-300 mb-1">Email Admin</label>
                <input 
                  type="email" 
                  required
                  placeholder="admin@lacasitagamer.com"
                  value={adminLoginForm.email}
                  onChange={(e) => {
                    setAdminLoginForm({...adminLoginForm, email: e.target.value});
                    setAdminLoginError(null);
                  }}
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
                  onChange={(e) => {
                    setAdminLoginForm({...adminLoginForm, password: e.target.value});
                    setAdminLoginError(null);
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white focus:border-purple-500 focus:outline-none"
                />
              </div>

              <button type="submit" disabled={isAdminLoginPending} className="w-full bg-purple-600 hover:bg-purple-500 disabled:cursor-wait disabled:opacity-60 text-white font-bold py-2 rounded-xl text-xs transition">
                {isAdminLoginPending ? 'Verificando…' : 'Iniciar Sesión Admin'}
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

            {checkoutError && (
              <p role="alert" className="rounded-xl border border-red-500/30 bg-red-950/30 p-3 text-xs text-red-300">
                {checkoutError}
              </p>
            )}

            <form onSubmit={handleProcessOrder} className="space-y-4">
              <div className="space-y-3 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
                <h3 className="text-xs font-bold text-purple-300 uppercase tracking-wider">1. Datos del Cliente</h3>
                <div>
                  <label className="block text-[11px] text-slate-300 mb-1">Nombre completo</label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    maxLength={120}
                    autoComplete="name"
                    placeholder="Tu nombre y apellido"
                    value={checkoutForm.name}
                    onChange={(e) => updateCheckoutForm('name', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white focus:border-purple-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-300 mb-1">Email (Recepción de Keys)</label>
                  <input 
                    type="email" 
                    required
                    placeholder="tu_email@gmail.com"
                    value={checkoutForm.email}
                    onChange={(e) => updateCheckoutForm('email', e.target.value)}
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
                    onChange={(e) => updateCheckoutForm('phone', e.target.value)}
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
                    onChange={(e) => {
                      checkoutRequestKey.current = null;
                      setUsePointsInCheckout(e.target.checked);
                    }}
                    className="w-4 h-4 accent-purple-600 rounded cursor-pointer"
                  />
                </div>
              )}

              <div className="space-y-3 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
                <h3 className="text-xs font-bold text-purple-300 uppercase tracking-wider">2. Selecciona tu método de pago</h3>
                <div>
                  <label className="block text-[11px] text-slate-300 mb-1">Método de pago</label>
                  <select
                    value={checkoutForm.paymentMethod}
                    onChange={(e) => {
                      updateCheckoutForm('paymentMethod', e.target.value);
                      setPaymentProofFile(null);
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white focus:border-purple-500 focus:outline-none"
                  >
                    <option value="pago_movil">Pago Móvil</option>
                    <option value="binance">Binance (USDT)</option>
                  </select>
                </div>
                {checkoutForm.paymentMethod === 'pago_movil' ? (
                  <>
                    <div className="space-y-2 rounded-xl border border-cyan-500/20 bg-slate-950 p-3">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-cyan-300">Datos para realizar el Pago Móvil</p>
                      {[
                        { label: 'Cédula / RIF', value: 'V25482865' },
                        { label: 'Número de teléfono', value: '04141055278' },
                        { label: 'Banco', value: 'Banco Provincial' },
                      ].map((detail) => (
                        <div key={detail.label} className="flex items-center justify-between gap-3 text-xs">
                          <span className="text-slate-400">{detail.label}</span>
                          <span className="flex items-center gap-2">
                            <strong className="text-white">{detail.value}</strong>
                            <button
                              type="button"
                              onClick={() => void copyPaymentDetail(detail.label, detail.value)}
                              className="rounded-md border border-slate-700 px-2 py-1 text-[10px] font-bold text-cyan-300 hover:border-cyan-400/50"
                              aria-label={`Copiar ${detail.label}`}
                            >
                              {copiedPaymentDetail === detail.label ? 'Copiado' : 'Copiar'}
                            </button>
                          </span>
                        </div>
                      ))}
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-300 mb-1">Banco desde el que enviaste</label>
                      <input
                        type="text"
                        required
                        maxLength={100}
                        placeholder="Ej. Banesco"
                        value={checkoutForm.bankName}
                        onChange={(e) => updateCheckoutForm('bankName', e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white focus:border-purple-500 focus:outline-none"
                      />
                    </div>
                  </>
                ) : (
                  <div className="space-y-3 rounded-xl border border-yellow-500/20 bg-slate-950 p-3">
                    <p className="text-xs leading-5 text-slate-300">
                      Envía el monto exacto en USDT a la cuenta Binance oficial de La Casita Gamer. Antes de transferir, confirma con soporte el UID o la dirección de depósito vigente.
                    </p>
                    <div>
                      <label className="block text-[11px] text-slate-300 mb-1">Captura del envío de USDT (PNG, JPG o WebP; máx. 5 MB)</label>
                      <input
                        type="file"
                        required
                        accept="image/png,image/jpeg,image/webp"
                        onChange={(event) => {
                          const file = event.target.files?.[0] ?? null;
                          checkoutRequestKey.current = null;
                          if (file && (file.size > 5 * 1024 * 1024 || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type))) {
                            setPaymentProofFile(null);
                            setCheckoutError('La captura debe ser PNG, JPG o WebP y no superar 5 MB.');
                            event.target.value = '';
                            return;
                          }
                          setCheckoutError(null);
                          setPaymentProofFile(file);
                        }}
                        className="block w-full text-xs text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-purple-600 file:px-3 file:py-2 file:text-xs file:font-bold file:text-white hover:file:bg-purple-500"
                      />
                      {paymentProofFile && (
                        <p className="mt-1 text-[10px] text-emerald-300">Captura seleccionada: {paymentProofFile.name}</p>
                      )}
                    </div>
                  </div>
                )}
                <div>
                  <label className="block text-[11px] text-slate-300 mb-1">
                    {checkoutForm.paymentMethod === 'binance' ? 'TXID / referencia de Binance' : 'Número de referencia del Pago Móvil'}
                  </label>
                  <input 
                    type="text" 
                    required
                    minLength={3}
                    maxLength={80}
                    placeholder="Ej. 7849102"
                    value={checkoutForm.referenceNumber}
                    onChange={(e) => updateCheckoutForm('referenceNumber', e.target.value)}
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
                  <span>{checkoutForm.paymentMethod === 'binance' ? 'Monto a enviar:' : 'Monto Pago Móvil:'}</span>
                  <span className="font-mono">
                    {checkoutForm.paymentMethod === 'binance'
                      ? `${finalCheckoutUsd.toFixed(2)} USDT`
                      : `${calculateBs(finalCheckoutUsd)} Bs.`}
                  </span>
                </div>
              </div>

              <button 
                type="submit" 
                disabled={isProcessingOrder}
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 disabled:cursor-wait disabled:opacity-60 text-white font-bold py-3 rounded-xl text-sm transition"
              >
                {isProcessingOrder ? 'Registrando pedido…' : 'Enviar referencia y crear pedido'}
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
                  onClick={() => { setIsCartOpen(false); setCheckoutError(null); setIsCheckoutOpen(true); }}
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