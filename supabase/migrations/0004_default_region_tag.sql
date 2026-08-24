-- 実運用テストで判明: public_suitability = 'not_suitable_internal_only' の
-- 記事は tag_region ジョブを実行しないため、region_tag が列のデフォルト値の
-- まま残る。デフォルトが 'undetermined' だったため「判定不能」の記事が
-- 出てしまった。ユーザー指示「どれにも当てはまらない場合は一旦『北多摩東部』
-- に振り分けてください」に合わせ、デフォルト値を変更する。
alter table articles alter column region_tag set default 'kitatama_tobu';

update articles set region_tag = 'kitatama_tobu', region_tag_source = 'ai'
where region_tag = 'undetermined';
