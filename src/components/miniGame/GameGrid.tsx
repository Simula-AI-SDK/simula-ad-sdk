import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { GameData, MiniGameTheme } from '../../types';
import { CoverCard } from './CoverCard';

const MAX_VISIBLE_DOTS = 5;
const DOT_SIZE_CURRENT = 10;
const DOT_SIZE_ADJACENT = 8;
const DOT_SIZE_EDGE = 6;
const DESKTOP_PAGE_SIZE = 4; // 4 cols × 1 row

interface GameGridProps {
  games: GameData[];
  maxGamesToShow?: 3 | 6 | 9;
  charID: string;
  theme: MiniGameTheme;
  onGameSelect: (gameId: string, gameName: string, gameDescription: string) => void;
  menuId?: string | null;
  navigationType?: 'dot' | 'arrow' | 'pagination';
}

const calculateVisibleDots = (currentPage: number, totalPages: number) => {
  if (totalPages <= MAX_VISIBLE_DOTS) {
    return Array.from({ length: totalPages }, (_, i) => ({
      pageIndex: i,
      isVisible: true,
    }));
  }

  const halfWindow = Math.floor(MAX_VISIBLE_DOTS / 2);
  let startPage = currentPage - halfWindow;
  let endPage = currentPage + halfWindow;

  if (startPage < 0) {
    startPage = 0;
    endPage = MAX_VISIBLE_DOTS - 1;
  }

  if (endPage >= totalPages) {
    endPage = totalPages - 1;
    startPage = totalPages - MAX_VISIBLE_DOTS;
  }

  return Array.from({ length: MAX_VISIBLE_DOTS }, (_, i) => ({
    pageIndex: startPage + i,
    isVisible: true,
  }));
};

const getDotSize = (pageIndex: number, currentPage: number): number => {
  const distance = Math.abs(pageIndex - currentPage);
  if (distance === 0) return DOT_SIZE_CURRENT;
  if (distance === 1) return DOT_SIZE_ADJACENT;
  return DOT_SIZE_EDGE;
};

const getDotOpacity = (pageIndex: number, currentPage: number): number => {
  const distance = Math.abs(pageIndex - currentPage);
  if (distance === 0) return 1;
  if (distance === 1) return 0.5;
  return 0.3;
};

// ─── Mobile Carousel ────────────────────────────────────────────

interface MobileCarouselProps {
  games: GameData[];
  onGameSelect: (gameId: string, gameName: string, gameDescription: string) => void;
  accentColor: string;
}

const MobileCarousel: React.FC<MobileCarouselProps> = ({ games, onGameSelect, accentColor }) => {
  const carouselRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [cardWidth, setCardWidth] = useState(0);
  const [cardHeight, setCardHeight] = useState(0);
  const [gap] = useState(12);
  const suppressScrollWrap = useRef(false);
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafId = useRef<number>(0);
  const n = games.length;
  const totalSlides = n * 3; // 3 copies for infinite loop

  // Measure and compute card dimensions
  useEffect(() => {
    const carousel = carouselRef.current;
    if (!carousel || n === 0) return;

    const measure = () => {
      const h = carousel.clientHeight;

      // Lock width to height-based 9:16 ratio and enforce minimum card height.
      const ch = Math.max(352, h * 0.78);
      const cw = (ch * 9) / 16;
      setCardWidth(cw);
      setCardHeight(ch);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(carousel);
    return () => observer.disconnect();
  }, [n, gap]);

  // Update card transforms based on scroll position (depth effect)
  const updateCardTransforms = useCallback(() => {
    const carousel = carouselRef.current;
    if (!carousel || cardWidth === 0) return;

    const scrollLeft = carousel.scrollLeft;
    const containerW = carousel.clientWidth;
    const viewportCenter = scrollLeft + containerW / 2;
    const slideStep = cardWidth + gap;

    slideRefs.current.forEach((el) => {
      if (!el) return;
      // Compute card center from its offsetLeft relative to the scroll content
      const cardCenter = el.offsetLeft + cardWidth / 2;
      const dist = Math.abs(cardCenter - viewportCenter) / slideStep;
      const clampedDist = Math.min(dist, 2);

      // Scale: center=1.0, ±1=0.92, ±2=0.84
      const scale = 1 - clampedDist * 0.08;
      // Z-index: center highest
      const z = clampedDist < 0.5 ? 3 : clampedDist < 1.5 ? 2 : 1;

      el.style.transform = `scale(${scale})`;
      el.style.zIndex = String(z);
    });
  }, [cardWidth, gap]);

  // Initial scroll to middle copy + apply transforms
  useEffect(() => {
    const carousel = carouselRef.current;
    if (!carousel || cardWidth === 0 || n === 0) return;

    const slideStep = cardWidth + gap;
    const setWidth = n * slideStep;
    suppressScrollWrap.current = true;

    carousel.style.scrollSnapType = 'none';
    carousel.scrollLeft = setWidth; // middle copy, index 0

    requestAnimationFrame(() => {
      if (!carousel) return;
      carousel.scrollLeft = setWidth;
      updateCardTransforms();
      requestAnimationFrame(() => {
        if (!carousel) return;
        carousel.scrollLeft = setWidth;
        carousel.style.scrollSnapType = 'x mandatory';
        updateCardTransforms();
        requestAnimationFrame(() => {
          if (!carousel) return;
          carousel.scrollLeft = setWidth;
          updateCardTransforms();
        });
        setTimeout(() => {
          suppressScrollWrap.current = false;
        }, 120);
      });
    });
  }, [cardWidth, n, gap, updateCardTransforms]);

  // Scroll handler: real-time transforms + debounced infinite loop wrap
  const onScroll = useCallback(() => {
    // Real-time transform updates (every frame for smooth depth effect)
    cancelAnimationFrame(rafId.current);
    rafId.current = requestAnimationFrame(() => {
      updateCardTransforms();
    });

    if (suppressScrollWrap.current) return;
    const carousel = carouselRef.current;
    if (!carousel || cardWidth === 0 || n === 0) return;

    // Debounced wrap-around + index tracking
    if (scrollTimer.current) clearTimeout(scrollTimer.current);
    scrollTimer.current = setTimeout(() => {
      if (suppressScrollWrap.current) return;
      const left = carousel.scrollLeft;
      const slideStep = cardWidth + gap;
      const setWidth = n * slideStep;
      const half = slideStep * 0.5;

      // Wrap around
      if (left < setWidth - half) {
        suppressScrollWrap.current = true;
        carousel.style.scrollSnapType = 'none';
        carousel.scrollLeft = left + setWidth;
        updateCardTransforms();
        requestAnimationFrame(() => {
          carousel.style.scrollSnapType = 'x mandatory';
          suppressScrollWrap.current = false;
        });
        return;
      }
      if (left >= 2 * setWidth - half) {
        suppressScrollWrap.current = true;
        carousel.style.scrollSnapType = 'none';
        carousel.scrollLeft = left - setWidth;
        updateCardTransforms();
        requestAnimationFrame(() => {
          carousel.style.scrollSnapType = 'x mandatory';
          suppressScrollWrap.current = false;
        });
        return;
      }

      const idx = Math.round(left / slideStep);
      const baseIndex = ((idx % n) + n) % n;
      setCurrentIndex(baseIndex);
    }, 100);
  }, [cardWidth, n, gap, updateCardTransforms]);

  useEffect(() => {
    const carousel = carouselRef.current;
    if (!carousel) return;
    carousel.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      carousel.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(rafId.current);
    };
  }, [onScroll]);

  const scrollToIndex = useCallback((index: number) => {
    const carousel = carouselRef.current;
    if (!carousel || cardWidth === 0 || n === 0) return;
    const slideStep = cardWidth + gap;
    const setWidth = n * slideStep;
    const normalizedIdx = ((index % n) + n) % n;
    carousel.scrollTo({ left: setWidth + normalizedIdx * slideStep, behavior: 'smooth' });
  }, [cardWidth, n, gap]);

  // Build flat index for ref assignment
  let slideIdx = 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: '0 1 auto', minHeight: 0, height: 'clamp(352px, 62vh, 640px)', position: 'relative' }}>
      {/* Carousel scroll container */}
      <div
        ref={carouselRef}
        style={{
          height: '100%',
          minHeight: '100%',
          overflowX: 'auto',
          overflowY: 'hidden',
          scrollSnapType: 'x mandatory',
          scrollSnapStop: 'always',
          WebkitOverflowScrolling: 'touch',
          overscrollBehaviorX: 'contain',
          touchAction: 'pan-x',
          display: 'flex',
          alignItems: 'center',
          marginTop: '4px',
        }}
        className="simula-carousel-scroll"
      >
        <style>{`
          .simula-carousel-scroll::-webkit-scrollbar { width: 0; height: 0; }
          .simula-carousel-scroll { scrollbar-width: none; }
        `}</style>
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            flexWrap: 'nowrap',
            width: 'max-content',
            gap: `${gap}px`,
            paddingLeft: '0',
            paddingRight: '0',
          }}
        >
          {/* 3 copies for infinite loop */}
          {[0, 1, 2].map((setIdx) =>
            games.map((game, i) => {
              const idx = slideIdx++;
              return (
                <div
                  key={`${setIdx}-${game.id}`}
                  ref={(el) => { slideRefs.current[idx] = el; }}
                  style={{
                    width: `${cardWidth}px`,
                    minWidth: `${cardWidth}px`,
                    flexShrink: 0,
                    scrollSnapAlign: 'center',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'transform 0.1s ease-out',
                    transformOrigin: 'center center',
                    paddingTop: '24px',
                    paddingBottom: '24px',
                    boxSizing: 'border-box',
                  }}
                >
                  <CoverCard
                    game={game}
                    onGameSelect={(id) => onGameSelect(id, game.name, game.description)}
                    style={{
                      width: `${cardWidth}px`,
                      maxWidth: `${cardWidth}px`,
                      height: `${cardHeight}px`,
                      aspectRatio: 'auto',
                    }}
                  />
                </div>
              );
            })
          )}
        </div>
      </div>

    </div>
  );
};

// ─── Desktop Grid ───────────────────────────────────────────────

interface DesktopGridProps {
  games: GameData[];
  theme: MiniGameTheme;
  onGameSelect: (gameId: string, gameName: string, gameDescription: string) => void;
  navigationType: 'dot' | 'arrow' | 'pagination';
}

const DesktopGrid: React.FC<DesktopGridProps> = ({ games, theme, onGameSelect, navigationType }) => {
  const [currentPage, setCurrentPage] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right' | null>(null);
  const [hoveredArrow, setHoveredArrow] = useState<'left' | 'right' | null>(null);
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const [cardWidth, setCardWidth] = useState<number | null>(null);

  const totalPages = useMemo(() => Math.ceil(games.length / DESKTOP_PAGE_SIZE), [games.length]);
  const accentColor = theme.accentColor || '#3B82F6';

  useEffect(() => {
    if (currentPage >= totalPages && totalPages > 0) {
      setCurrentPage(totalPages - 1);
    }
  }, [totalPages, currentPage]);

  const currentGames = useMemo(() => {
    const start = currentPage * DESKTOP_PAGE_SIZE;
    return games.slice(start, start + DESKTOP_PAGE_SIZE);
  }, [games, currentPage]);

  const visibleDots = useMemo(() => calculateVisibleDots(currentPage, totalPages), [currentPage, totalPages]);

  // Desktop card width follows card height using fixed 9:16 ratio.
  useEffect(() => {
    const measure = () => {
      const ch = Math.max(352, window.innerHeight * 0.52);
      const cwFromH = (ch * 9) / 16;
      setCardWidth(cwFromH);
    };

    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const animateToPage = useCallback((newPage: number, direction: 'left' | 'right') => {
    if (isAnimating) return;
    setIsAnimating(true);
    setSlideDirection(direction);
    setTimeout(() => {
      setCurrentPage(newPage);
      setSlideDirection(null);
      setIsAnimating(false);
    }, 250);
  }, [isAnimating]);

  const handleDotClick = (pageIndex: number) => {
    if (pageIndex === currentPage || isAnimating) return;
    animateToPage(pageIndex, pageIndex > currentPage ? 'left' : 'right');
  };

  // Touch swipe support
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (isAnimating) return;
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }, [isAnimating]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current || isAnimating) return;
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;
    touchStartRef.current = null;

    const SWIPE_THRESHOLD = 50;
    if (Math.abs(deltaX) < SWIPE_THRESHOLD || Math.abs(deltaY) > Math.abs(deltaX)) return;

    if (deltaX < 0 && currentPage < totalPages - 1) {
      animateToPage(currentPage + 1, 'left');
    } else if (deltaX > 0 && currentPage > 0) {
      animateToPage(currentPage - 1, 'right');
    }
  }, [isAnimating, currentPage, totalPages, animateToPage]);

  const handlePrevPage = useCallback(() => {
    if (currentPage > 0 && !isAnimating) animateToPage(currentPage - 1, 'right');
  }, [currentPage, isAnimating, animateToPage]);

  const handleNextPage = useCallback(() => {
    if (currentPage < totalPages - 1 && !isAnimating) animateToPage(currentPage + 1, 'left');
  }, [currentPage, totalPages, isAnimating, animateToPage]);

  const showPagination = totalPages > 1;
  const paginationRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    minHeight: '50px',
    padding: '0',
    borderRadius: '0',
    background: 'transparent',
    border: 'none',
    boxShadow: 'none',
    backdropFilter: 'none',
    width: 'fit-content',
    margin: '0 auto',
  };

  const paginationButtonStyle: React.CSSProperties = {
    width: '40px',
    height: '40px',
    borderRadius: '999px',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    background: 'rgba(255, 255, 255, 0.08)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
  };

  return (
    <>
      <style>{`
        @keyframes slideOutLeft {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(-30%); opacity: 0; }
        }
        @keyframes slideOutRight {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(30%); opacity: 0; }
        }
        @keyframes slideInFromRight {
          from { transform: translateX(15%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideInFromLeft {
          from { transform: translateX(-15%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .simula-desktop-grid.slide-left {
          animation: slideOutLeft 0.125s ease-out forwards;
        }
        .simula-desktop-grid.slide-right {
          animation: slideOutRight 0.125s ease-out forwards;
        }
        .simula-desktop-grid.slide-in-left {
          animation: slideInFromLeft 0.125s ease-out forwards;
        }
        .simula-desktop-grid.slide-in-right {
          animation: slideInFromRight 0.125s ease-out forwards;
        }
      `}</style>

      {/* Grid */}
      <div
        ref={gridContainerRef}
        className={`simula-desktop-grid ${
          slideDirection === 'left' ? 'slide-left' :
          slideDirection === 'right' ? 'slide-right' : ''
        }`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{
          display: 'grid',
          gridTemplateColumns: cardWidth ? `repeat(4, ${cardWidth}px)` : 'repeat(4, 1fr)',
          columnGap: '24px',
          rowGap: '0',
          width: '100%',
          minHeight: 0,
          alignContent: 'center',
          justifyContent: 'center',
          touchAction: 'pan-y',
        }}
      >
        {currentGames.map((game) => (
          <CoverCard
            key={game.id}
            game={game}
            onGameSelect={(id) => onGameSelect(id, game.name, game.description)}
            style={{
              width: cardWidth ? `${cardWidth}px` : undefined,
              maxWidth: cardWidth ? `${cardWidth}px` : undefined,
              height: 'auto',
            }}
          />
        ))}
      </div>

      {/* Dot Navigation */}
      {showPagination && navigationType === 'dot' && (
        <div style={paginationRowStyle}>
          {visibleDots.map((dot) => {
            const size = getDotSize(dot.pageIndex, currentPage);
            const dotOpacity = getDotOpacity(dot.pageIndex, currentPage);
            const isCurrent = dot.pageIndex === currentPage;
            return (
              <button
                key={dot.pageIndex}
                onClick={() => handleDotClick(dot.pageIndex)}
                style={{ padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: isCurrent ? 'default' : 'pointer' }}
                aria-label={`Page ${dot.pageIndex + 1} of ${totalPages}`}
                aria-current={isCurrent ? 'page' : undefined}
              >
                <span style={{ width: `${size}px`, height: `${size}px`, borderRadius: '50%', backgroundColor: accentColor, opacity: dotOpacity, display: 'block', transition: 'all 0.2s ease' }} />
              </button>
            );
          })}
        </div>
      )}

      {/* Arrow Navigation */}
      {showPagination && navigationType === 'arrow' && (
        <div style={paginationRowStyle}>
          <button
            onClick={handlePrevPage}
            onMouseEnter={() => setHoveredArrow('left')}
            onMouseLeave={() => setHoveredArrow(null)}
            disabled={currentPage === 0}
            style={{ ...paginationButtonStyle, cursor: currentPage === 0 ? 'default' : 'pointer', opacity: currentPage === 0 ? 0.35 : hoveredArrow === 'left' ? 1 : 0.82 }}
            aria-label="Previous page"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button
            onClick={handleNextPage}
            onMouseEnter={() => setHoveredArrow('right')}
            onMouseLeave={() => setHoveredArrow(null)}
            disabled={currentPage === totalPages - 1}
            style={{ ...paginationButtonStyle, cursor: currentPage === totalPages - 1 ? 'default' : 'pointer', opacity: currentPage === totalPages - 1 ? 0.35 : hoveredArrow === 'right' ? 1 : 0.82 }}
            aria-label="Next page"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      )}

      {/* Pagination Text Navigation */}
      {showPagination && navigationType === 'pagination' && (
        <div style={{ ...paginationRowStyle, fontFamily: theme.secondaryFont || 'Inter, system-ui, sans-serif', fontSize: '16px', gap: '14px' }}>
          <button
            onClick={handlePrevPage}
            onMouseEnter={() => setHoveredArrow('left')}
            onMouseLeave={() => setHoveredArrow(null)}
            disabled={currentPage === 0}
            style={{ ...paginationButtonStyle, width: 'auto', minWidth: '88px', padding: '0 14px', cursor: currentPage === 0 ? 'default' : 'pointer', opacity: currentPage === 0 ? 0.35 : hoveredArrow === 'left' ? 1 : 0.82, color: accentColor, fontFamily: 'inherit', fontSize: 'inherit', fontWeight: 700 }}
            aria-label="Previous page"
          >
            Prev
          </button>
          <span style={{ color: theme.secondaryFontColor || '#A7AFBF', userSelect: 'none', fontWeight: 600 }}>{currentPage + 1} / {totalPages}</span>
          <button
            onClick={handleNextPage}
            onMouseEnter={() => setHoveredArrow('right')}
            onMouseLeave={() => setHoveredArrow(null)}
            disabled={currentPage === totalPages - 1}
            style={{ ...paginationButtonStyle, width: 'auto', minWidth: '88px', padding: '0 14px', cursor: currentPage === totalPages - 1 ? 'default' : 'pointer', opacity: currentPage === totalPages - 1 ? 0.35 : hoveredArrow === 'right' ? 1 : 0.82, color: accentColor, fontFamily: 'inherit', fontSize: 'inherit', fontWeight: 700 }}
            aria-label="Next page"
          >
            Next
          </button>
        </div>
      )}
    </>
  );
};

// ─── Main GameGrid ──────────────────────────────────────────────

export const GameGrid: React.FC<GameGridProps> = ({
  games,
  charID,
  theme,
  onGameSelect,
  menuId,
  navigationType = 'dot',
}) => {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth < 768
  );

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    setIsMobile(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const accentColor = theme.accentColor || '#3B82F6';

  if (isMobile) {
    return (
      <MobileCarousel
        games={games}
        onGameSelect={onGameSelect}
        accentColor={accentColor}
      />
    );
  }

  return (
    <DesktopGrid
      games={games}
      theme={theme}
      onGameSelect={onGameSelect}
      navigationType={navigationType}
    />
  );
};
