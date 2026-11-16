<?php
declare(strict_types=1);

function ingredient_copy_catalog(PDO $pdo, string $source, string $destination, array $ids): array
{
    $ids = array_values(array_unique(array_map('strval', $ids)));
    if ($source === $destination || !$ids || count($ids)>300) throw new RuntimeException('Chọn quầy khác và từ 1 đến 300 nguyên liệu.');
    $created = 0; $skipped = 0; $mapped = []; $visiting = [];
    $pdo->beginTransaction();
    try {
        $copy = function(string $id) use (&$copy, &$created, &$skipped, &$mapped, &$visiting, $pdo, $source, $destination): string {
            if (isset($mapped[$id])) return $mapped[$id];
            if (isset($visiting[$id])) throw new RuntimeException('Công thức có thành phần lặp vòng.');
            $visiting[$id]=true;
            $q=$pdo->prepare('SELECT * FROM ingredients WHERE id=? AND store_id=? AND is_active=1');
            $q->execute([$id,$source]); $row=$q->fetch();
            if (!$row) throw new RuntimeException('Nguyên liệu nguồn không khả dụng.');
            $q=$pdo->prepare('SELECT * FROM ingredients WHERE store_id=? AND ingredient_code=?');
            $q->execute([$destination,$row['ingredient_code']]); $existing=$q->fetch();
            if ($existing) {
                $unit=static fn(array $r):string=>(string)(($r['base_unit']??'') ?: $r['unit']);
                $q=$pdo->prepare('SELECT COUNT(*) FROM ingredient_components WHERE parent_ingredient_id=?');
                $q->execute([$id]); $sourcePrepared=(int)$q->fetchColumn()>0;
                $q->execute([$existing['id']]); $targetPrepared=(int)$q->fetchColumn()>0;
                if (!$existing['is_active'] || $unit($row)!==$unit($existing) || $sourcePrepared!==$targetPrepared) throw new RuntimeException('Mã '.$row['ingredient_code'].' tại quầy nhận bị ẩn hoặc khác đơn vị / loại nguyên liệu.');
                $skipped++; unset($visiting[$id]); return $mapped[$id]=(string)$existing['id'];
            }
            $q=$pdo->prepare('SELECT component_ingredient_id,input_quantity FROM ingredient_components WHERE parent_ingredient_id=?');
            $q->execute([$id]); $components=$q->fetchAll(); $recipe=[];
            foreach ($components as $component) $recipe[]=['id'=>$copy((string)$component['component_ingredient_id']),'quantity'=>$component['input_quantity']];
            $newId=uuidv4();
            $columns=['ingredient_code','ingredient_name','normalized_name','unit','purchase_unit','base_unit','purchase_to_base_factor','cost','supplier_item_code','description','item_kind','conversion_input_quantity','conversion_output_quantity'];
            $values=array_map(static fn(string $key)=>$row[$key]??null,$columns);
            $supplier=null;
            if (!empty($row['supplier_id'])) {
                $q=$pdo->prepare('SELECT target.id FROM suppliers original JOIN suppliers target ON target.supplier_code=original.supplier_code WHERE original.id=? AND target.store_id=? AND target.is_active=1');
                $q->execute([$row['supplier_id'],$destination]); $supplier=$q->fetchColumn() ?: null;
            }
            $legacySource=$recipe[0]['id']??null;
            $sql='INSERT INTO ingredients (id,store_id,'.implode(',',$columns).',supplier_id,conversion_source_ingredient_id,stock_quantity,preparation_stock_quantity,is_active) VALUES ('.implode(',',array_fill(0,count($columns)+7,'?')).')';
            $pdo->prepare($sql)->execute(array_merge([$newId,$destination],$values,[$supplier,$legacySource,0,0,1]));
            $q=$pdo->prepare('INSERT INTO ingredient_components(parent_ingredient_id,component_ingredient_id,input_quantity) VALUES (?,?,?)');
            foreach ($recipe as $component) $q->execute([$newId,$component['id'],$component['quantity']]);
            $created++; unset($visiting[$id]); return $mapped[$id]=$newId;
        };
        foreach ($ids as $id) $copy($id);
        $pdo->commit();
        return ['createdCount'=>$created,'skippedCount'=>$skipped];
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
}
