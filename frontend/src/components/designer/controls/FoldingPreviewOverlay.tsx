'use client';

import React from 'react';
import { CanvasDimensions, DocumentSettings } from '@/types/designer';
import { PrintLayoutConfig, SideFoldingLayout } from '@/types/folding';
import { resolveSideFoldingLayout, normalizeFoldMargin, normalizeFoldBleed } from '@/utils/foldingLayout';

export interface FoldingPreviewOverlayProps {
  dimensions: CanvasDimensions;
  documentSettings: DocumentSettings;
  side?: 'front' | 'back';
  showBleed?: boolean;
  showTrim?: boolean;
  showSafeZone?: boolean;
  showFolds?: boolean;
  showMarginGuides?: boolean;
  showBleedGuides?: boolean;
  showPanelLabels?: boolean;
  className?: string;
}

export const FoldingPreviewOverlay: React.FC<FoldingPreviewOverlayProps> = ({
  dimensions,
  documentSettings,
  side = 'front',
  showBleed = true,
  showTrim = true,
  showSafeZone = true,
  showFolds = true,
  showMarginGuides = true,
  showBleedGuides = true,
  showPanelLabels = true,
  className = '',
}) => {
  const dpi = Math.max(1, Number(dimensions.dpi) || 300);
  const bleedPx = Math.max(0, Number(dimensions.bleedPx) || 0);
  const trimWidthPx = Math.max(1, Number(dimensions.widthPx) || 1063);
  const trimHeightPx = Math.max(1, Number(dimensions.heightPx) || 591);
  const totalWidthPx = Number(dimensions.totalWidthPx) || (trimWidthPx + bleedPx * 2);
  const totalHeightPx = Number(dimensions.totalHeightPx) || (trimHeightPx + bleedPx * 2);

  const trimWidthMm = Number(dimensions.widthMm) || Number(documentSettings.width) || 297;
  const trimHeightMm = Number(dimensions.heightMm) || Number(documentSettings.height) || 210;
  const bleedMm = Number(dimensions.bleedMm ?? documentSettings.bleed ?? 3);

  const printLayout: PrintLayoutConfig | null =
    dimensions.printLayout || documentSettings.printLayout || null;

  const foldingConfig = printLayout?.folding;
  const hasFolding = Boolean(foldingConfig?.enabled && (foldingConfig.folds?.length || foldingConfig.panels?.length));

  const sideLayout: SideFoldingLayout = hasFolding && foldingConfig
    ? resolveSideFoldingLayout(foldingConfig, side)
    : { panels: [], folds: [] };

  const isVertical = foldingConfig?.panelOrientation !== 'horizontal';

  // Safe margin calculations
  const safeMarginTop = printLayout?.safeMargin?.top ?? documentSettings.safeArea ?? 5;
  const safeMarginRight = printLayout?.safeMargin?.right ?? documentSettings.safeArea ?? 5;
  const safeMarginBottom = printLayout?.safeMargin?.bottom ?? documentSettings.safeArea ?? 5;
  const safeMarginLeft = printLayout?.safeMargin?.left ?? documentSettings.safeArea ?? 5;

  const safeLeftPx = bleedPx + Math.round((safeMarginLeft / 25.4) * dpi);
  const safeTopPx = bleedPx + Math.round((safeMarginTop / 25.4) * dpi);
  const safeRightPx = bleedPx + trimWidthPx - Math.round((safeMarginRight / 25.4) * dpi);
  const safeBottomPx = bleedPx + trimHeightPx - Math.round((safeMarginBottom / 25.4) * dpi);

  const mmToPx = (mm: number) => Math.round((mm / 25.4) * dpi);

  return (
    <svg
      viewBox={`0 0 ${totalWidthPx} ${totalHeightPx}`}
      className={`absolute inset-0 w-full h-full pointer-events-none select-none z-10 ${className}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Semi-transparent pattern for fold margin safe zone */}
        <pattern id="fold-safe-stripe" width="8" height="8" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="8" stroke="rgba(16, 185, 129, 0.25)" strokeWidth="1.5" />
        </pattern>
        {/* Semi-transparent pattern for fold bleed zone */}
        <pattern id="fold-bleed-stripe" width="8" height="8" patternTransform="rotate(-45 0 0)" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="8" stroke="rgba(236, 72, 153, 0.25)" strokeWidth="1.5" />
        </pattern>
      </defs>

      {/* 1. OUTER BLEED BOUNDARY */}
      {showBleed && bleedPx > 0 && (
        <g id="preview-bleed-envelope">
          <rect
            x="1"
            y="1"
            width={totalWidthPx - 2}
            height={totalHeightPx - 2}
            fill="none"
            stroke="rgba(239, 68, 68, 0.85)"
            strokeWidth="1.5"
            strokeDasharray="6 4"
          />
        </g>
      )}

      {/* 2. PRODUCT TRIM CUT LINE */}
      {showTrim && (
        <g id="preview-trim-line">
          {/* Subtle contrast casing */}
          <rect
            x={bleedPx}
            y={bleedPx}
            width={trimWidthPx}
            height={trimHeightPx}
            fill="none"
            stroke="rgba(255, 255, 255, 0.9)"
            strokeWidth="2.5"
          />
          <rect
            x={bleedPx}
            y={bleedPx}
            width={trimWidthPx}
            height={trimHeightPx}
            fill="none"
            stroke="#000000"
            strokeWidth="1.25"
          />
        </g>
      )}

      {/* 3. PRODUCT OUTER SAFE MARGIN */}
      {showSafeZone && safeRightPx > safeLeftPx && safeBottomPx > safeTopPx && (
        <g id="preview-outer-safe-zone">
          <rect
            x={safeLeftPx}
            y={safeTopPx}
            width={safeRightPx - safeLeftPx}
            height={safeBottomPx - safeTopPx}
            fill="none"
            stroke="rgba(16, 185, 129, 0.85)"
            strokeWidth="1.2"
            strokeDasharray="5 4"
          />
        </g>
      )}

      {/* 4. FOLDING SYSTEM: Panels, Fold Lines, Margins, Bleeds */}
      {hasFolding && showFolds && (
        <g id="preview-folding-system">
          {/* Panel Dividers & Headers */}
          {showPanelLabels && sideLayout.panels.length > 0 && (
            <g id="preview-panels">
              {(() => {
                let currentOffsetMm = 0;
                return sideLayout.panels.map((panel, pIdx) => {
                  const panelStartPx = bleedPx + mmToPx(currentOffsetMm);
                  const panelWidthPx = mmToPx(panel.width);
                  currentOffsetMm += panel.width;

                  const centerX = panelStartPx + panelWidthPx / 2;
                  const labelY = bleedPx + 24;

                  return (
                    <g key={panel.id || `panel-${pIdx}`}>
                      {/* Subtle panel header pill */}
                      <rect
                        x={centerX - 48}
                        y={labelY - 14}
                        width="96"
                        height="20"
                        rx="10"
                        fill="rgba(15, 23, 42, 0.85)"
                        stroke="rgba(148, 163, 184, 0.5)"
                        strokeWidth="1"
                      />
                      <text
                        x={centerX}
                        y={labelY}
                        fill="#f8fafc"
                        fontSize="10"
                        fontWeight="bold"
                        textAnchor="middle"
                        fontFamily="system-ui, -apple-system, sans-serif"
                      >
                        {(pIdx === 2 || panel.index === 2)
                          ? 'Logo Panel'
                          : (panel.label || `Panel ${pIdx + 1}`)} ({panel.width}mm)
                      </text>
                    </g>
                  );
                });
              })()}
            </g>
          )}

          {/* Folds */}
          {sideLayout.folds.map((fold, fIdx) => {
            const margin = normalizeFoldMargin(fold);
            const bleed = normalizeFoldBleed(fold);

            if (isVertical) {
              const foldPx = bleedPx + mmToPx(fold.position);
              if (foldPx <= bleedPx || foldPx >= bleedPx + trimWidthPx) return null;

              const marginLeftPx = mmToPx(margin.left);
              const marginRightPx = mmToPx(margin.right);
              const marginTopPx = mmToPx(margin.top);
              const marginBottomPx = mmToPx(margin.bottom);

              const safeY = bleedPx + marginTopPx;
              const safeH = Math.max(0, trimHeightPx - marginTopPx - marginBottomPx);
              const safeW = marginLeftPx + marginRightPx;

              const bleedLeftPx = mmToPx(bleed.left);
              const bleedRightPx = mmToPx(bleed.right);
              const bleedTopPx = mmToPx(bleed.top);
              const bleedBottomPx = mmToPx(bleed.bottom);

              const bleedY = Math.max(0, bleedPx - bleedTopPx);
              const bleedH = trimHeightPx + bleedTopPx + bleedBottomPx;

              return (
                <g key={fold.id || `fold-${fIdx}`}>
                  {/* Fold Safe Margin Shading & Bounds */}
                  {showMarginGuides && safeW > 0 && safeH > 0 && (
                    <g id={`fold-margin-${fIdx}`}>
                      <rect
                        x={foldPx - marginLeftPx}
                        y={safeY}
                        width={safeW}
                        height={safeH}
                        fill="url(#fold-safe-stripe)"
                      />
                      {/* Left margin boundary */}
                      {marginLeftPx > 0 && (
                        <line
                          x1={foldPx - marginLeftPx}
                          y1={safeY}
                          x2={foldPx - marginLeftPx}
                          y2={safeY + safeH}
                          stroke="rgba(16, 185, 129, 0.9)"
                          strokeWidth="1"
                          strokeDasharray="4 4"
                        />
                      )}
                      {/* Right margin boundary */}
                      {marginRightPx > 0 && (
                        <line
                          x1={foldPx + marginRightPx}
                          y1={safeY}
                          x2={foldPx + marginRightPx}
                          y2={safeY + safeH}
                          stroke="rgba(16, 185, 129, 0.9)"
                          strokeWidth="1"
                          strokeDasharray="4 4"
                        />
                      )}
                      {/* Top boundary */}
                      {marginTopPx > 0 && (
                        <line
                          x1={foldPx - marginLeftPx}
                          y1={safeY}
                          x2={foldPx + marginRightPx}
                          y2={safeY}
                          stroke="rgba(16, 185, 129, 0.9)"
                          strokeWidth="1"
                          strokeDasharray="4 4"
                        />
                      )}
                      {/* Bottom boundary */}
                      {marginBottomPx > 0 && (
                        <line
                          x1={foldPx - marginLeftPx}
                          y1={safeY + safeH}
                          x2={foldPx + marginRightPx}
                          y2={safeY + safeH}
                          stroke="rgba(16, 185, 129, 0.9)"
                          strokeWidth="1"
                          strokeDasharray="4 4"
                        />
                      )}

                      {/* Margin dimension badge at bottom */}
                      <g>
                        <rect
                          x={foldPx - 42}
                          y={bleedPx + trimHeightPx - 28}
                          width="84"
                          height="18"
                          rx="9"
                          fill="rgba(6, 78, 59, 0.9)"
                          stroke="rgba(52, 211, 153, 0.7)"
                          strokeWidth="1"
                        />
                        <text
                          x={foldPx}
                          y={bleedPx + trimHeightPx - 16}
                          fill="#a7f3d0"
                          fontSize="9"
                          fontWeight="600"
                          textAnchor="middle"
                          fontFamily="monospace"
                        >
                          L:{margin.left} R:{margin.right}mm
                        </text>
                      </g>
                    </g>
                  )}

                  {/* Fold Bleed Area */}
                  {showBleedGuides && (bleedLeftPx > 0 || bleedRightPx > 0) && (
                    <g id={`fold-bleed-${fIdx}`}>
                      {bleedLeftPx > 0 && (
                        <line
                          x1={foldPx - bleedLeftPx}
                          y1={bleedY}
                          x2={foldPx - bleedLeftPx}
                          y2={bleedY + bleedH}
                          stroke="rgba(236, 72, 153, 0.85)"
                          strokeWidth="0.9"
                          strokeDasharray="3 4"
                        />
                      )}
                      {bleedRightPx > 0 && (
                        <line
                          x1={foldPx + bleedRightPx}
                          y1={bleedY}
                          x2={foldPx + bleedRightPx}
                          y2={bleedY + bleedH}
                          stroke="rgba(236, 72, 153, 0.85)"
                          strokeWidth="0.9"
                          strokeDasharray="3 4"
                        />
                      )}
                    </g>
                  )}

                  {/* Fold Crease Tick Marks extending into outer bleed */}
                  <line
                    x1={foldPx}
                    y1={0}
                    x2={foldPx}
                    y2={bleedPx}
                    stroke="#000000"
                    strokeWidth="1.5"
                  />
                  <line
                    x1={foldPx}
                    y1={bleedPx + trimHeightPx}
                    x2={foldPx}
                    y2={totalHeightPx}
                    stroke="#000000"
                    strokeWidth="1.5"
                  />

                  {/* Fold Crease Line across sheet */}
                  <line
                    x1={foldPx}
                    y1={bleedPx}
                    x2={foldPx}
                    y2={bleedPx + trimHeightPx}
                    stroke="rgba(59, 130, 246, 0.95)"
                    strokeWidth="1.6"
                    strokeDasharray="8 5"
                  />

                  {/* Fold Position Pill Badge at Top */}
                  <g>
                    <rect
                      x={foldPx - 38}
                      y={bleedPx + 42}
                      width="76"
                      height="18"
                      rx="9"
                      fill="rgba(30, 58, 138, 0.9)"
                      stroke="rgba(96, 165, 250, 0.8)"
                      strokeWidth="1"
                    />
                    <text
                      x={foldPx}
                      y={bleedPx + 54}
                      fill="#dbeafe"
                      fontSize="9"
                      fontWeight="bold"
                      textAnchor="middle"
                      fontFamily="system-ui, -apple-system, sans-serif"
                    >
                      Fold {fIdx + 1}: {fold.position}mm
                    </text>
                  </g>
                </g>
              );
            } else {
              // Horizontal folds
              const foldPx = bleedPx + mmToPx(fold.position);
              if (foldPx <= bleedPx || foldPx >= bleedPx + trimHeightPx) return null;

              const marginTopPx = mmToPx(margin.top);
              const marginBottomPx = mmToPx(margin.bottom);
              const marginLeftPx = mmToPx(margin.left);
              const marginRightPx = mmToPx(margin.right);

              const safeX = bleedPx + marginLeftPx;
              const safeW = Math.max(0, trimWidthPx - marginLeftPx - marginRightPx);
              const safeH = marginTopPx + marginBottomPx;

              return (
                <g key={fold.id || `fold-${fIdx}`}>
                  {/* Margin shading */}
                  {showMarginGuides && safeW > 0 && safeH > 0 && (
                    <g id={`fold-margin-h-${fIdx}`}>
                      <rect
                        x={safeX}
                        y={foldPx - marginTopPx}
                        width={safeW}
                        height={safeH}
                        fill="url(#fold-safe-stripe)"
                      />
                      {marginTopPx > 0 && (
                        <line
                          x1={safeX}
                          y1={foldPx - marginTopPx}
                          x2={safeX + safeW}
                          y2={foldPx - marginTopPx}
                          stroke="rgba(16, 185, 129, 0.9)"
                          strokeWidth="1"
                          strokeDasharray="4 4"
                        />
                      )}
                      {marginBottomPx > 0 && (
                        <line
                          x1={safeX}
                          y1={foldPx + marginBottomPx}
                          x2={safeX + safeW}
                          y2={foldPx + marginBottomPx}
                          stroke="rgba(16, 185, 129, 0.9)"
                          strokeWidth="1"
                          strokeDasharray="4 4"
                        />
                      )}
                    </g>
                  )}

                  {/* Horizontal fold line */}
                  <line
                    x1={bleedPx}
                    y1={foldPx}
                    x2={bleedPx + trimWidthPx}
                    y2={foldPx}
                    stroke="rgba(59, 130, 246, 0.95)"
                    strokeWidth="1.6"
                    strokeDasharray="8 5"
                  />
                </g>
              );
            }
          })}
        </g>
      )}
    </svg>
  );
};
