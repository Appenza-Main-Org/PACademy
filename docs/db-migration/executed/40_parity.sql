SELECT COALESCE(p.tbl,s.tbl) AS tbl, p.rows AS prod, s.rows AS staging,
       CASE WHEN ISNULL(p.rows,-1)<>ISNULL(s.rows,-1) THEN 'MISMATCH' ELSE 'OK' END AS status
FROM (SELECT t.name tbl, SUM(ps.row_count) rows
      FROM DB_PAcademy_Prod.sys.tables t
      JOIN DB_PAcademy_Prod.sys.schemas sc ON sc.schema_id=t.schema_id
      JOIN DB_PAcademy_Prod.sys.dm_db_partition_stats ps ON ps.object_id=t.object_id AND ps.index_id IN(0,1)
      WHERE sc.name='dbo' AND t.name NOT LIKE '\_\_EF%' ESCAPE '\' GROUP BY t.name) p
FULL JOIN (SELECT t.name tbl, SUM(ps.row_count) rows
      FROM DB_PAcademy_Staging.sys.tables t
      JOIN DB_PAcademy_Staging.sys.schemas sc ON sc.schema_id=t.schema_id
      JOIN DB_PAcademy_Staging.sys.dm_db_partition_stats ps ON ps.object_id=t.object_id AND ps.index_id IN(0,1)
      WHERE sc.name='dbo' AND t.name NOT LIKE '\_\_EF%' ESCAPE '\' GROUP BY t.name) s ON s.tbl=p.tbl
ORDER BY CASE WHEN ISNULL(p.rows,-1)<>ISNULL(s.rows,-1) THEN 0 ELSE 1 END, COALESCE(p.tbl,s.tbl);
SELECT COUNT(*) AS mismatches FROM (
  SELECT t.name FROM DB_PAcademy_Prod.sys.tables t JOIN DB_PAcademy_Prod.sys.schemas sc ON sc.schema_id=t.schema_id WHERE sc.name='dbo'
  EXCEPT SELECT t.name FROM DB_PAcademy_Staging.sys.tables t JOIN DB_PAcademy_Staging.sys.schemas sc ON sc.schema_id=t.schema_id WHERE sc.name='dbo') d;
