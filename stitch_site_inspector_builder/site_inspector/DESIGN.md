---
name: Site Inspector
colors:
  surface: '#f8f9ff'
  surface-dim: '#d6dae3'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f0f4fc'
  surface-container: '#eaeef6'
  surface-container-high: '#e5e8f1'
  surface-container-highest: '#dfe2eb'
  on-surface: '#171c22'
  on-surface-variant: '#3e4a3f'
  inverse-surface: '#2c3137'
  inverse-on-surface: '#edf1f9'
  outline: '#6e7a6e'
  outline-variant: '#bdcabc'
  surface-tint: '#006d3a'
  primary: '#006a38'
  on-primary: '#ffffff'
  primary-container: '#008648'
  on-primary-container: '#f6fff4'
  inverse-primary: '#65dd90'
  secondary: '#5c5e63'
  on-secondary: '#ffffff'
  secondary-container: '#e1e2e8'
  on-secondary-container: '#626469'
  tertiary: '#b61722'
  on-tertiary: '#ffffff'
  tertiary-container: '#da3437'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#82faaa'
  primary-fixed-dim: '#65dd90'
  on-primary-fixed: '#00210d'
  on-primary-fixed-variant: '#00522a'
  secondary-fixed: '#e1e2e8'
  secondary-fixed-dim: '#c5c6cc'
  on-secondary-fixed: '#191c20'
  on-secondary-fixed-variant: '#44474b'
  tertiary-fixed: '#ffdad7'
  tertiary-fixed-dim: '#ffb3ad'
  on-tertiary-fixed: '#410004'
  on-tertiary-fixed-variant: '#930013'
  background: '#f8f9ff'
  on-background: '#171c22'
  surface-variant: '#dfe2eb'
typography:
  display-lg:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '800'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 20px
    fontWeight: '700'
    lineHeight: '1.4'
  body-sm:
    fontFamily: Hanken Grotesk
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1.5'
  terminal-code:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '400'
    lineHeight: '1.6'
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '700'
    lineHeight: '1'
    letterSpacing: 0.05em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  panel-padding: 16px
  gutter: 12px
  component-gap: 8px
---

## Brand & Style
The design system is built on a **Modernized Physical Laboratory** aesthetic. It moves away from the ephemeral nature of modern web software and anchors the user in a high-precision, industrial environment. The brand personality is authoritative, technical, and tactile, designed specifically for developers who value density and structural clarity.

The UI is treated as a piece of hardware—a literal "Site Inspector" device. The style utilizes **Tactile Skeuomorphism** and **Industrial Minimalism**. Surfaces are modeled after brushed aluminum and anodized steel, utilizing physical metaphors like recessed bays for data displays and raised enclosures for physical control toggles. Every element should feel like it has physical mass and mechanical state.

## Colors
The palette is rooted in industrial materials and electrical indicators. 
- **Chassis (Surfaces):** A range of cool grays (#d8dbe0 to #9a9ea6) represent the brushed metal body. Use linear gradients (top-left to bottom-right) to simulate light hitting metal.
- **The CRT/Terminal:** Deep Charcoal (#24272b) is reserved for data-rich areas and code displays, providing a high-contrast environment for technical inspection.
- **Indicators & Actuators:** Green is the primary signal for "Power On" or "Active" states. Bright Green (#4ade80) serves as the emissive light source (the "glow"), while Primary Green (#22a55e) is the solid material color of the physical buttons.
- **Tactical Red:** Specifically reserved for "Picking" or "Inspection" modes, mimicking a laser-guided targeting system.

## Typography
The typography system balances modern precision with technical legibility. 
- **UI & Controls:** Hanken Grotesk provides a sharp, contemporary "engineered" feel for all interface labels, headers, and inputs.
- **Technical Data:** JetBrains Mono is used for all code, attributes, and "readout" data. This font should always appear in Terminal Green (#4ade80) when placed on the Deep Charcoal background.
- **Labeling:** Use `label-caps` for permanent "etched" hardware labels (e.g., above a knob or a button group) to mimic industrial silk-screening.

## Layout & Spacing
The layout follows a **Fixed-Panel System** mimicking a modular rack-mount unit. The interface is divided into functional "bays."
- **Grid:** Use a tight 4px baseline grid. Elements should feel densely packed but mathematically aligned.
- **Panel Reflow:** On Desktop, panels are docked into a multi-column workbench. On Tablet, panels collapse into a stacked "vertical rack." 
- **Margins:** External margins are minimized to maximize technical workspace, while internal panel padding is generous (16px) to maintain the "etched" look of the enclosures.

## Elevation & Depth
Depth is the core of this design system, achieved through **Beveled Geometry**:
- **Raised Panels (Chassis):** Use a 1px white highlight on the top/left edge and a 1px dark shadow (#7a7e85) on the bottom/right edge. Add a subtle 2px blur drop shadow to give the panel "weight" over the background.
- **Recessed Areas (Displays/Wells):** Use `box-shadow: inset 2px 2px 4px rgba(0,0,0,0.3)` to sink the terminal and input areas into the metal chassis.
- **Materiality:** Apply a very fine noise texture (2% opacity) over metal surfaces to prevent them from appearing too "digital."

## Shapes
The shape language is strictly industrial. 
- **Radius:** Use a subtle 4px radius (`roundedness: 1`) for the main panel enclosures. This represents high-grade machined metal.
- **Hard Edges:** Internal structural elements (code blocks, terminal lines) should use 0px radius to emphasize the "digital readout" contrast.
- **Circular Elements:** Use full circles for LEDs, toggle switches, and "Status" indicators.

## Components
- **Glossy Buttons:** Primary buttons are green with a subtle top-to-bottom radial gradient. Apply a white "specular highlight" at the top edge. On hover, the brightness increases. On press, the button "sinks" (reverse the shadow to `inset` and shift content down 1px).
- **Terminal Display:** A recessed bay with #1a1c1e background. Text is strictly JetBrains Mono. Use a faint scanline overlay (horizontal 1px lines at 5% opacity).
- **LED Indicators:** Small 8px circles. "Off" state is a dark desaturated green; "On" state is #4ade80 with a 4px outer glow.
- **Input Fields:** Recessed into the metal. Use a dark border on top and light border on bottom to create the "punched-out" effect.
- **READY Badges:** Styled like physical metal plates riveted to the UI. Use bold JetBrains Mono text and a high-contrast background.
- **The "Picker" Tool:** When active, the cursor turns into a tactical crosshair, and the inspected element on the web page is outlined with a 2px "Tactical Red" (#ef4444) border with a faint pulsing glow.