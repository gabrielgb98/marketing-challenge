import {createClient} from '@supabase/supabase-js';export const db=()=>process.env.NEXT_PUBLIC_SUPABASE_URL&&process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY):null;
export const qs=[
['¿Qué busca la segmentación de mercado?','Agrupar clientes con necesidades similares','Vender a todos igual','Eliminar la competencia','Reducir salarios',0,35],
['Una tienda recibe visitas pero pocas compras. ¿Qué conviene analizar?','Sólo seguidores','Barreras en el proceso de compra','Cambiar el logo','Eliminar la web',1,45],
['¿Cuál NO es una de las 4P tradicionales?','Producto','Precio','Plaza','Personalidad',3,35],
['Una marca quiere fidelizar a clientes que compran una sola vez. ¿Qué harías?','Ignorar reclamos','Subir precios sin cambios','Crear beneficios de recompra','Cerrar redes',2,45],
['¿Qué es una propuesta de valor?','Beneficio relevante y diferencial para el cliente','El presupuesto anual','La lista de empleados','Un impuesto',0,35],
['Una cafetería apunta a estudiantes. ¿Qué decisión tiene más sentido?','Ofrecer combos accesibles en horarios útiles','Promocionarse sólo en revistas de lujo','Cerrar al mediodía','Subir precios sin razón',0,45],
['¿Qué mide la tasa de conversión?','Cantidad de empleados','Porcentaje que realiza una acción objetivo','Gasto fijo','Número de proveedores',1,35],
['Una marca busca posicionamiento premium. ¿Qué debería cuidar?','Sólo los descuentos','Coherencia entre producto, servicio y comunicación','Copiar todo','Prometer lo imposible',1,45],
['¿Qué diferencia una necesidad de un deseo?','Son exactamente iguales','El deseo es una forma particular de satisfacer una necesidad','La necesidad siempre es cara','Los deseos no influyen',1,35],
['Una campaña tiene alcance pero pocas consultas. ¿Qué revisarías?','Público, propuesta y llamado a la acción','Sólo impresiones','El uniforme interno','La oficina',0,45]
] as const;