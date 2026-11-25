-- Visits count on every page load. Databases created before that change
-- start from these totals, without turning the clock back once they grow.
update public.site_stats
   set visits = greatest(visits, 669),
       visitors = greatest(visitors, 363)
 where id = 1;
