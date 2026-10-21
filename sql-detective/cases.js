export const seed = `
CREATE TABLE products(product_id INTEGER PRIMARY KEY,product_name TEXT,opening_stock INTEGER,book_stock INTEGER);
INSERT INTO products VALUES(1,'帆布袋',100,76),(2,'马克杯',80,70),(3,'贴纸套装',200,152),(4,'随行笔记本',120,100);
CREATE TABLE stock_moves(move_id INTEGER PRIMARY KEY,product_id INTEGER,change_qty INTEGER,reason TEXT);
INSERT INTO stock_moves VALUES(1,1,-15,'正常出库'),(2,1,-4,'活动领用'),(3,2,-10,'正常出库'),(4,3,-25,'正常出库'),(5,3,-18,'活动领用'),(6,4,-20,'正常出库');
CREATE TABLE orders(order_id INTEGER PRIMARY KEY,customer_name TEXT,paid_amount INTEGER,status TEXT);
INSERT INTO orders VALUES(1001,'顾客甲',120,'已完成'),(1002,'顾客乙',80,'已退款'),(1003,'顾客丙',150,'已完成'),(1004,'顾客丁',200,'已退款');
CREATE TABLE refunds(refund_id INTEGER PRIMARY KEY,order_id INTEGER,amount INTEGER,state TEXT);
INSERT INTO refunds VALUES(1,1001,20,'成功'),(2,1002,80,'成功'),(3,1003,50,'处理中'),(4,1004,150,'成功'),(5,1004,50,'失败');
CREATE TABLE role_grants(grant_id INTEGER PRIMARY KEY,role_name TEXT,table_name TEXT,privilege TEXT);
INSERT INTO role_grants VALUES(1,'报表员','orders','SELECT'),(2,'报表员','orders','UPDATE'),(3,'报表员','customers_private','SELECT'),(4,'库存员','stock_moves','INSERT'),(5,'库存员','products','SELECT'),(6,'审核员','refunds','SELECT');
CREATE TABLE allowed_grants(role_name TEXT,table_name TEXT,privilege TEXT);
INSERT INTO allowed_grants VALUES('报表员','orders','SELECT'),('库存员','stock_moves','INSERT'),('库存员','products','SELECT'),('审核员','refunds','SELECT');`;
export const cases = [
 {id:'inventory',number:'01',title:'消失的库存',subtitle:'账面少了几件，证据藏在哪张表？',level:'入门调查',tags:['LEFT JOIN','SUM','GROUP BY'],brief:'文创店盘点发现库存账面值与出入库记录可能不一致。你的任务是从流水重算库存，找出需要复核的商品。',task:'返回所有库存不一致的商品，按顺序输出 product_id、product_name、difference。difference = 期初库存 + 净变动 − 账面库存。',caution:'只定位差异，不凭结果认定偷盗或责任人。所有商品与流水均为虚构训练数据。',tables:[{name:'products',label:'商品与账面库存',fields:[['product_id','INT · 主键'],['product_name','VARCHAR'],['opening_stock','INT · 期初'],['book_stock','INT · 账面']]},{name:'stock_moves',label:'库存变动流水',fields:[['move_id','INT · 主键'],['product_id','INT · 关联商品'],['change_qty','INT · 正负变动'],['reason','VARCHAR']]}],starter:'-- 先查看商品和流水，找到可以连接的字段\nSELECT *\nFROM products;',answer:`SELECT p.product_id, p.product_name,
       p.opening_stock + COALESCE(SUM(m.change_qty), 0)
         - p.book_stock AS difference
FROM products AS p
LEFT JOIN stock_moves AS m ON p.product_id = m.product_id
GROUP BY p.product_id, p.product_name, p.opening_stock, p.book_stock
HAVING difference <> 0;`,expected:[[1,'帆布袋',5],[3,'贴纸套装',5]],hints:['先分别看 products 和 stock_moves。两张表使用 product_id 关联。','净变动需要 SUM(change_qty)。使用 LEFT JOIN，避免漏掉没有流水的商品。','按商品分组，用期初 + COALESCE(SUM(变动), 0) − 账面计算差异，在 HAVING 中保留非零结果。'],question:'定位到差异后，还需要哪些证据才能判断原因？',choices:['只凭差异就认定有人拿走商品','复核漏记流水、盘点时间和原始单据','直接修改账面让数字相等'],correct:1,explain:'差异只说明记录之间不一致。漏记、时间口径或盘点错误都可能造成差异，需要补充证据。',knowledge:'连接后先按业务对象聚合；LEFT JOIN配合COALESCE保留无流水对象。'},
 {id:'refund',number:'02',title:'未到账的退款',subtitle:'退款成功，到底应该算哪一笔？',level:'口径核查',tags:['条件聚合','LEFT JOIN','NULL'],brief:'客服发现有些订单已标记“已退款”，但成功退款金额未必等于实付金额。请用退款流水复核，而不是相信状态文字。',task:'只检查 status 为“已退款”的订单。返回成功退款总额小于实付金额的订单，按顺序输出 order_id、paid_amount、refunded_amount。',caution:'只累计 state 为“成功”的退款。处理中与失败均不算到账；金额单位为元，无真实客户。',tables:[{name:'orders',label:'订单实付与状态',fields:[['order_id','INT · 主键'],['customer_name','VARCHAR · 虚构'],['paid_amount','INT · 元'],['status','VARCHAR']]},{name:'refunds',label:'多次退款流水',fields:[['refund_id','INT · 主键'],['order_id','INT · 关联订单'],['amount','INT · 元'],['state','VARCHAR']]}],starter:"-- 先确认哪些订单被标记为已退款\nSELECT *\nFROM orders\nWHERE status = '已退款';",answer:`SELECT o.order_id, o.paid_amount,
       COALESCE(SUM(CASE WHEN r.state = '成功' THEN r.amount ELSE 0 END), 0) AS refunded_amount
FROM orders AS o
LEFT JOIN refunds AS r ON o.order_id = r.order_id
WHERE o.status = '已退款'
GROUP BY o.order_id, o.paid_amount
HAVING refunded_amount < o.paid_amount;`,expected:[[1004,200,150]],hints:['订单状态只是筛选条件；到账金额必须从 refunds 流水计算。','同一订单可能有多条退款记录。用 CASE WHEN 只累计“成功”金额。','按订单聚合，再用 HAVING 比较成功退款总额和 paid_amount。不要把失败退款加进去。'],question:'找出1004号订单后，能否直接判断平台拖欠退款？',choices:['可以，状态文字已经证明责任','不能，还需核对支付渠道、时间和原始记录','把失败退款也算成功就没有问题了'],correct:1,explain:'数据库差异是复核线索，不能单凭模拟记录确定真实责任。状态、支付渠道和时间口径都需要核实。',knowledge:'条件聚合需要保留完整业务口径，不能把所有退款流水金额直接相加。'},
 {id:'access',number:'03',title:'多出来的权限',subtitle:'岗位需要什么，账号却能做什么？',level:'安全审查',tags:['NOT EXISTS','权限清单','最小权限'],brief:'一份模拟角色授权清单需要审查。allowed_grants清单已经由组织负责人确认，请找出实际授权中没有获准的条目。',task:'对照 allowed_grants，找出 role_grants 中未被允许的授权，按顺序输出 role_name、table_name、privilege。',caution:'这里只查询模拟授权台账，不是MySQL系统权限核验，也不会执行GRANT或REVOKE。',tables:[{name:'role_grants',label:'实际授权台账',fields:[['grant_id','INT · 主键'],['role_name','VARCHAR'],['table_name','VARCHAR'],['privilege','VARCHAR']]},{name:'allowed_grants',label:'已批准的授权清单',fields:[['role_name','VARCHAR'],['table_name','VARCHAR'],['privilege','VARCHAR']]}],starter:'-- 查看实际授权，思考三个字段如何同时匹配\nSELECT *\nFROM role_grants;',answer:`SELECT g.role_name, g.table_name, g.privilege
FROM role_grants AS g
WHERE NOT EXISTS (
  SELECT 1 FROM allowed_grants AS a
  WHERE a.role_name = g.role_name
    AND a.table_name = g.table_name
    AND a.privilege = g.privilege
);`,expected:[['报表员','orders','UPDATE'],['报表员','customers_private','SELECT']],hints:['需要同时匹配角色、表名、权限，不能只检查角色是否存在。','可以使用 NOT EXISTS，寻找批准清单里不存在的同一授权。','子查询的三个匹配条件都要使用 AND；外层保留 NOT EXISTS 的行。'],question:'发现超出清单的授权后，下一步应该怎么做？',choices:['不核实业务影响，立即删除所有权限','让负责人复核并按流程调整，再验证业务可用性','只要有SELECT权限就一定没有风险'],correct:1,explain:'最小权限需要结合批准范围和业务影响。查询只定位待审核条目，实际变更应由授权人员按流程执行。',knowledge:'权限包含角色、对象和操作三个维度；只读也可能接触不应访问的数据。'}
];
