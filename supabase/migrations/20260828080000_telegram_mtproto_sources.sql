-- Pin function resolution to trusted schemas. This addresses mutable
-- search_path warnings without changing function bodies or permissions.
alter function public.set_updated_at()
  set search_path = public, pg_temp;

alter function public.get_discovery_feed(uuid, integer)
  set search_path = public, pg_temp;

alter function public.calibrate_discovery_score(double precision, double precision, double precision)
  set search_path = public, pg_temp;

alter function public.calibrated_personal_score(double precision)
  set search_path = public, pg_temp;

alter function public.calibrated_trending_score(double precision)
  set search_path = public, pg_temp;

alter function public.discovery_semantic_hybrid_score(
  double precision,
  double precision,
  double precision,
  double precision
)
  set search_path = public, pg_temp;