import {cases} from './cases.js';
const spec={
  inventory:[
    {stage:'观察',title:'认识库存账面',task:'读取全部商品，按顺序输出 product_id、product_name、opening_stock、book_stock。此步只观察记录，不判断异常。',starter:'SELECT product_id FROM products;',answer:'SELECT product_id, product_name, opening_stock, book_stock FROM products;',hints:['数据在products表。','输出四个字段，顺序需要一致。','不需要筛选或连接，用SELECT列出任务指定字段。'],question:'仅比较期初与账面库存，能确定发生了异常吗？',choices:['能，账面变化一定是记录错误','不能，还需结合期间出入库流水','能，库存不应该变化'],correct:1,explain:'正常入库与出库也会使库存变化，必须结合流水核查。',knowledge:'先读懂字段，再界定异常；记录本身不等于异常。'},
    {stage:'定位',title:'定位库存差异'},
    {stage:'验证',title:'检验没有流水的商品',task:'找出完全没有库存变动流水的商品，按顺序输出 product_id、product_name。净变动为0不等于没有流水。',starter:'SELECT product_id, product_name FROM products;',answer:'SELECT p.product_id, p.product_name FROM products p WHERE NOT EXISTS (SELECT 1 FROM stock_moves m WHERE m.product_id=p.product_id);',hints:['有流水但正负抵消，与没有流水不同。','使用NOT EXISTS，或LEFT JOIN检查流水主键是否为空。','不要用SUM(change_qty)=0代替不存在记录。'],question:'净变动为0是否说明没有流水？',choices:['是，求和为0代表没有记录','不一定，入库和出库可能相互抵消','是，数据库会自动删除零和流水'],correct:1,explain:'SUM描述数量，EXISTS描述记录是否存在，两者不能互换。',knowledge:'用无流水与正负抵消的反例，验证查询边界。'}
  ],
  refund:[
    {stage:'观察',title:'确认退款检查范围',task:'只读取状态为“已退款”的订单，按顺序输出 order_id、paid_amount。金额以分为单位。',starter:'SELECT order_id, paid_amount FROM orders;',answer:"SELECT order_id, paid_amount FROM orders WHERE status='已退款';",hints:['检查范围由orders.status决定。','用WHERE限制订单行，先不用连接退款表。',"筛选status='已退款'。"],question:'“已退款”状态能否单独证明钱已到账？',choices:['能，状态文字就是到账证明','不能，还需要核对成功流水和核对时点','能，不需要检查金额'],correct:1,explain:'状态是业务记录，需要结合成功流水、金额与时点核实。',knowledge:'先确定核查对象，避免在错误范围内计算。'},
    {stage:'定位',title:'核对成功退款金额',question:'找出成功退款不足的订单后，能否直接判断平台拖欠退款？'},
    {stage:'验证',title:'追查缺失的退款记录',task:'找出状态为“已退款”、但完全没有退款流水的订单，按顺序输出 order_id、paid_amount。只有失败记录不属于“没有流水”。',starter:"SELECT order_id, paid_amount FROM orders WHERE status='已退款';",answer:"SELECT o.order_id, o.paid_amount FROM orders o WHERE o.status='已退款' AND NOT EXISTS (SELECT 1 FROM refunds r WHERE r.order_id=o.order_id);",hints:['无成功退款不等于没有退款记录。','筛选已退款订单，再看refunds是否存在同订单记录。','NOT EXISTS的子查询不要再限制state成功。'],question:'没有查到退款流水，下一步最合理的做法是什么？',choices:['直接认定客户在说谎','核对数据同步、支付渠道和原始退款凭证','随便补一条成功流水'],correct:1,explain:'可能有同步遗漏或口径差异，必须补充原始证据。',knowledge:'区分缺失记录、失败记录和处理中记录。'}
  ],
  access:[
    {stage:'观察',title:'绘制角色授权概况',task:'按角色统计实际授权台账记录数，按顺序输出 role_name、grant_count。重复台账记录也计入本步骤的记录数。',starter:'SELECT role_name FROM role_grants;',answer:'SELECT role_name, COUNT(*) AS grant_count FROM role_grants GROUP BY role_name;',hints:['每个角色对应多条授权记录。','GROUP BY role_name，每组COUNT(*)。','本步骤统计记录数，不要求COUNT(DISTINCT)。'],question:'授权记录最多的角色一定最危险吗？',choices:['是，数量能直接代表风险','不一定，还需看对象、操作和批准范围','是，可以直接删除其全部权限'],correct:1,explain:'数量是观察线索，风险要结合敏感性与批准范围。',knowledge:'聚合辅助理解分布，不能只凭条数判断风险。'},
    {stage:'定位',title:'定位超范围授权'},
    {stage:'验证',title:'复核敏感表只读权限',task:'读取对 customers_private 表拥有 SELECT 的实际授权，按顺序输出 role_name、table_name。此步只定位敏感表只读授权，不直接判定是否违规。',starter:'SELECT role_name, table_name FROM role_grants;',answer:"SELECT role_name, table_name FROM role_grants WHERE table_name='customers_private' AND privilege='SELECT';",hints:['同时限制对象与操作。','WHERE中两个条件用AND连接。','只读也会暴露数据，需要核对批准范围。'],question:'SELECT只读权限是否一定安全？',choices:['一定安全，因为它不能修改数据','不一定，读取敏感信息也需要授权','一定安全，所有角色都应该有'],correct:1,explain:'读取敏感数据同样受授权范围约束，不能只关注写入。',knowledge:'角色、对象和操作共同构成授权含义。'}
  ]
};
for(const c of cases)c.tasks=spec[c.id].map((s,i)=>({...c,...s,id:c.id+'-'+['read','locate','verify'][i],caseId:c.id,index:i}));
export {cases};
export const allTasks=cases.flatMap(c=>c.tasks);
