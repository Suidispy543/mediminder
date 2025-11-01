import React, { useState, useEffect } from 'react';
import { Button } from '/ui/Button';
import { Card } from '@/components/ui/Card';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Accessibility, 
  Type, 
  Eye, 
  Palette,
  Settings,
  X,
  Minus,
  Plus,
  Link,
  AlignLeft,
  Play,
  ImageOff,
  MousePointer,
  List,
  Moon,
  Sun,
  Languages,
  RotateCcw
} from 'lucide-react';

interface AccessibilitySettings {
  isOpen: boolean;
  fontSize: number;
  contrast: number;
  dyslexicFont: boolean;
  highlightLinks: boolean;
  textSpacing: boolean;
  pauseAnimations: boolean;
  hideImages: boolean;
  largeCursor: boolean;
  pageStructure: boolean;
  darkMode: boolean;
}

type Language = 'en' | 'es';

// Translation object embedded in the code
const translations = {
  en: {
    accessibility: 'Accessibility',
    textSize: 'Text Size',
    contrast: 'Contrast',
    darkMode: 'Dark Mode',
    dyslexiaFont: 'Dyslexia-Friendly Font',
    highlightLinks: 'Highlight Links',
    textSpacing: 'Text Spacing',
    pauseAnimations: 'Pause Animations',
    hideImages: 'Hide Images',
    largeCursor: 'Large Cursor',
    pageStructure: 'Page Structure',
    resetDefault: 'Reset to Default',
    language: 'Language',
    resetLanguage: 'Reset Language',
    closePanel: 'Close accessibility panel',
    openPanel: 'Open accessibility options',
    decreaseTextSize: 'Decrease text size',
    increaseTextSize: 'Increase text size',
    decreaseContrast: 'Decrease contrast',
    increaseContrast: 'Increase contrast',
    toggleDarkMode: 'Toggle dark mode',
    toggleDyslexicFont: 'Toggle dyslexia-friendly font',
    toggleLinkHighlight: 'Toggle link highlighting',
    toggleTextSpacing: 'Toggle text spacing',
    toggleAnimationPause: 'Toggle animation pausing',
    toggleImageVisibility: 'Toggle image visibility',
    toggleLargeCursor: 'Toggle large cursor',
    togglePageStructure: 'Toggle page structure outline',
  },
  es: {
    accessibility: 'Accesibilidad',
    textSize: 'Tamaño de Texto',
    contrast: 'Contraste',
    darkMode: 'Modo Oscuro',
    dyslexiaFont: 'Fuente para Dislexia',
    highlightLinks: 'Resaltar Enlaces',
    textSpacing: 'Espaciado de Texto',
    pauseAnimations: 'Pausar Animaciones',
    hideImages: 'Ocultar Imágenes',
    largeCursor: 'Cursor Grande',
    pageStructure: 'Estructura de Página',
    resetDefault: 'Restablecer por Defecto',
    language: 'Idioma',
    resetLanguage: 'Restablecer Idioma',
    closePanel: 'Cerrar panel de accesibilidad',
    openPanel: 'Abrir opciones de accesibilidad',
    decreaseTextSize: 'Disminuir tamaño de texto',
    increaseTextSize: 'Aumentar tamaño de texto',
    decreaseContrast: 'Disminuir contraste',
    increaseContrast: 'Aumentar contraste',
    toggleDarkMode: 'Alternar modo oscuro',
    toggleDyslexicFont: 'Alternar fuente para dislexia',
    toggleLinkHighlight: 'Alternar resaltado de enlaces',
    toggleTextSpacing: 'Alternar espaciado de texto',
    toggleAnimationPause: 'Alternar pausa de animaciones',
    toggleImageVisibility: 'Alternar visibilidad de imágenes',
    toggleLargeCursor: 'Alternar cursor grande',
    togglePageStructure: 'Alternar estructura de página',
  }
};

const AccessibilityWidget = () => {
  const [settings, setSettings] = useState<AccessibilitySettings>({
    isOpen: false,
    fontSize: 100,
    contrast: 100,
    dyslexicFont: false,
    highlightLinks: false,
    textSpacing: false,
    pauseAnimations: false,
    hideImages: false,
    largeCursor: false,
    pageStructure: false,
    darkMode: false,
  });

  const [language, setLanguage] = useState<Language>('en');

  // Load settings and language from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('accessibility-settings');
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      setSettings(prev => ({ ...prev, ...parsed }));
      applySettings(parsed);
    }

    const savedLanguage = localStorage.getItem('accessibility-language');
    if (savedLanguage && (savedLanguage === 'en' || savedLanguage === 'es')) {
      setLanguage(savedLanguage as Language);
      document.documentElement.setAttribute('data-current-language', savedLanguage);
    } else {
      document.documentElement.setAttribute('data-current-language', 'en');
    }
  }, []);

  // Save settings to localStorage and apply them
  const updateSettings = (newSettings: Partial<AccessibilitySettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    localStorage.setItem('accessibility-settings', JSON.stringify(updated));
    applySettings(updated);
  };

  // Apply accessibility settings to the document
  const applySettings = (settings: AccessibilitySettings) => {
    const html = document.documentElement;
    const body = document.body;
    
    // Font size adjustment
    html.style.fontSize = `${settings.fontSize}%`;
    
    // Contrast adjustment
    html.style.filter = `contrast(${settings.contrast}%)`;
    
    // Dyslexic font
    if (settings.dyslexicFont) {
      loadDyslexicFont();
      html.style.fontFamily = '"OpenDyslexic", sans-serif';
    } else {
      html.style.fontFamily = '';
    }

    // Dark mode toggle
    if (settings.darkMode) {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }

    // Highlight links
    updateStyleRule('highlight-links', settings.highlightLinks ? 
      'a { border-bottom: 2px solid #FF0000 !important; }' : '');

    // Text spacing
    updateStyleRule('text-spacing', settings.textSpacing ? 
      '* { letter-spacing: 0.12em !important; line-height: 1.5 !important; }' : '');

    // Pause animations
    updateStyleRule('pause-animations', settings.pauseAnimations ? 
      '*, *::before, *::after { animation-delay: -1ms !important; animation-duration: 1ms !important; animation-iteration-count: 1 !important; background-attachment: initial !important; scroll-behavior: auto !important; }' : '');

    // Hide images
    updateStyleRule('hide-images', settings.hideImages ? 
      'img { visibility: hidden !important; }' : '');

    // Large cursor
    if (settings.largeCursor) {
      body.style.cursor = 'url("data:image/svg+xml;charset=utf8,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'32\' height=\'32\' viewBox=\'0 0 32 32\'%3E%3Cpath d=\'M2 2 L2 28 L12 18 L18 24 L22 20 L16 14 L26 14 Z\' fill=\'%23000\' stroke=\'%23fff\' stroke-width=\'2\'/%3E%3C/svg%3E") 16 16, auto';
    } else {
      body.style.cursor = '';
    }

    // Page structure outline
    updateStyleRule('page-structure', settings.pageStructure ? 
      'h1, h2, h3, h4, h5, h6 { outline: 2px solid #007cba !important; outline-offset: 2px !important; }' : '');
  };

  // Helper function to update CSS rules
  const updateStyleRule = (id: string, css: string) => {
    let style = document.getElementById(`accessibility-${id}`);
    if (!style && css) {
      style = document.createElement('style');
      style.id = `accessibility-${id}`;
      document.head.appendChild(style);
    }
    if (style) {
      style.textContent = css;
      if (!css) {
        style.remove();
      }
    }
  };

  // Load OpenDyslexic font
  const loadDyslexicFont = () => {
    if (!document.querySelector('#opendyslexic-font')) {
      const link = document.createElement('link');
      link.id = 'opendyslexic-font';
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/npm/opendyslexic@latest/opendyslexic.css';
      document.head.appendChild(link);
    }
  };

  const adjustFontSize = (direction: 'increase' | 'decrease') => {
    const change = direction === 'increase' ? 10 : -10;
    const newSize = Math.max(80, Math.min(150, settings.fontSize + change));
    updateSettings({ fontSize: newSize });
  };

  const adjustContrast = (direction: 'increase' | 'decrease') => {
    const change = direction === 'increase' ? 10 : -10;
    const newContrast = Math.max(50, Math.min(200, settings.contrast + change));
    updateSettings({ contrast: newContrast });
  };

  const resetSettings = () => {
    const defaultSettings = {
      fontSize: 100,
      contrast: 100,
      dyslexicFont: false,
      highlightLinks: false,
      textSpacing: false,
      pauseAnimations: false,
      hideImages: false,
      largeCursor: false,
      pageStructure: false,
      darkMode: false,
    };
    updateSettings(defaultSettings);
  };

  const updateLanguage = (newLanguage: Language) => {
    setLanguage(newLanguage);
    localStorage.setItem('accessibility-language', newLanguage);
    // Update DOM attribute for other components to detect
    document.documentElement.setAttribute('data-current-language', newLanguage);
  };

  const resetLanguage = () => {
    updateLanguage('en');
  };

  const t = translations[language];

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Export language for AI chatbot */}
      <div style={{ display: 'none' }} data-current-language={language}></div>
      {/* Control Panel */}
      {settings.isOpen && (
        <Card className="absolute bottom-16 right-0 w-80 bg-background border-border shadow-lg animate-slide-up max-h-[32rem] overflow-y-auto">
          <div className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold text-foreground">
                  {t.accessibility}
                </h2>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => updateSettings({ isOpen: false })}
                className="h-8 w-8 p-0"
                aria-label={t.closePanel}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Language Selection */}
            <div className="space-y-3 mb-6">
              <div className="flex items-center gap-2">
                <Languages className="h-4 w-4 text-primary" />
                <label className="text-sm font-medium text-foreground">
                  {t.language}
                </label>
              </div>
              <div className="flex gap-2">
                <Select value={language} onValueChange={(value: Language) => updateLanguage(value)}>
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="es">Español</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetLanguage}
                  className="px-3"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
            </div>


            {/* Controls */}
            <div className="space-y-6">
              {/* Font Size */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Type className="h-4 w-4 text-primary" />
                  <label className="text-sm font-medium text-foreground">
                    {t.textSize}
                  </label>
                </div>
                <div className="flex items-center justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => adjustFontSize('decrease')}
                    disabled={settings.fontSize <= 80}
                    className="h-8 w-8 p-0"
                    aria-label={t.decreaseTextSize}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="text-sm text-muted-foreground min-w-[3rem] text-center">
                    {settings.fontSize}%
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => adjustFontSize('increase')}
                    disabled={settings.fontSize >= 150}
                    className="h-8 w-8 p-0"
                    aria-label={t.increaseTextSize}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Contrast Adjustment */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-primary" />
                  <label className="text-sm font-medium text-foreground">
                    {t.contrast}
                  </label>
                </div>
                <div className="flex items-center justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => adjustContrast('decrease')}
                    disabled={settings.contrast <= 50}
                    className="h-8 w-8 p-0"
                    aria-label={t.decreaseContrast}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="text-sm text-muted-foreground min-w-[3rem] text-center">
                    {settings.contrast}%
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => adjustContrast('increase')}
                    disabled={settings.contrast >= 200}
                    className="h-8 w-8 p-0"
                    aria-label={t.increaseContrast}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Dark Mode */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {settings.darkMode ? <Moon className="h-4 w-4 text-primary" /> : <Sun className="h-4 w-4 text-primary" />}
                  <label className="text-sm font-medium text-foreground">
                    {t.darkMode}
                  </label>
                </div>
                <Switch
                  checked={settings.darkMode}
                  onCheckedChange={(checked) => updateSettings({ darkMode: checked })}
                  aria-label={t.toggleDarkMode}
                />
              </div>

              <Separator />

              {/* Dyslexic Font */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Palette className="h-4 w-4 text-primary" />
                  <label className="text-sm font-medium text-foreground">
                    {t.dyslexiaFont}
                  </label>
                </div>
                <Switch
                  checked={settings.dyslexicFont}
                  onCheckedChange={(checked) => updateSettings({ dyslexicFont: checked })}
                  aria-label={t.toggleDyslexicFont}
                />
              </div>

              <Separator />

              {/* Highlight Links */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Link className="h-4 w-4 text-primary" />
                  <label className="text-sm font-medium text-foreground">
                    {t.highlightLinks}
                  </label>
                </div>
                <Switch
                  checked={settings.highlightLinks}
                  onCheckedChange={(checked) => updateSettings({ highlightLinks: checked })}
                  aria-label={t.toggleLinkHighlight}
                />
              </div>

              <Separator />

              {/* Text Spacing */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlignLeft className="h-4 w-4 text-primary" />
                  <label className="text-sm font-medium text-foreground">
                    {t.textSpacing}
                  </label>
                </div>
                <Switch
                  checked={settings.textSpacing}
                  onCheckedChange={(checked) => updateSettings({ textSpacing: checked })}
                  aria-label={t.toggleTextSpacing}
                />
              </div>

              <Separator />

              {/* Pause Animations */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Play className="h-4 w-4 text-primary" />
                  <label className="text-sm font-medium text-foreground">
                    {t.pauseAnimations}
                  </label>
                </div>
                <Switch
                  checked={settings.pauseAnimations}
                  onCheckedChange={(checked) => updateSettings({ pauseAnimations: checked })}
                  aria-label={t.toggleAnimationPause}
                />
              </div>

              <Separator />

              {/* Hide Images */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ImageOff className="h-4 w-4 text-primary" />
                  <label className="text-sm font-medium text-foreground">
                    {t.hideImages}
                  </label>
                </div>
                <Switch
                  checked={settings.hideImages}
                  onCheckedChange={(checked) => updateSettings({ hideImages: checked })}
                  aria-label={t.toggleImageVisibility}
                />
              </div>

              <Separator />

              {/* Large Cursor */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MousePointer className="h-4 w-4 text-primary" />
                  <label className="text-sm font-medium text-foreground">
                    {t.largeCursor}
                  </label>
                </div>
                <Switch
                  checked={settings.largeCursor}
                  onCheckedChange={(checked) => updateSettings({ largeCursor: checked })}
                  aria-label={t.toggleLargeCursor}
                />
              </div>

              <Separator />

              {/* Page Structure */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <List className="h-4 w-4 text-primary" />
                  <label className="text-sm font-medium text-foreground">
                    {t.pageStructure}
                  </label>
                </div>
                <Switch
                  checked={settings.pageStructure}
                  onCheckedChange={(checked) => updateSettings({ pageStructure: checked })}
                  aria-label={t.togglePageStructure}
                />
              </div>

              <Separator />

              {/* Reset Button */}
              <Button
                variant="outline"
                onClick={resetSettings}
                className="w-full"
              >
                {t.resetDefault}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Floating Button */}
      <Button
        onClick={() => updateSettings({ isOpen: !settings.isOpen })}
        className="h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg animate-bounce-in hover:scale-105 hover:shadow-xl transition-all duration-300"
        aria-label={settings.isOpen ? t.closePanel : t.openPanel}
        aria-expanded={settings.isOpen}
      >
        <Accessibility className="h-6 w-6" />
      </Button>
    </div>
  );
};

export default AccessibilityWidget;
export { type Language };