import React, { useMemo } from 'react';
import { ParsedJO } from '../types';

interface TotalClosedTablesProps {
  rows: ParsedJO[];
  monthName: string;
}

function formatCount(val: number): string {
  return Math.round(val || 0).toLocaleString('en-PH');
}

function formatPeso(val: number): string {
  return `₱${Math.round(val || 0).toLocaleString('en-PH')}`;
}

export const TotalClosedTables: React.FC<TotalClosedTablesProps> = ({
  rows,
  monthName,
}) => {
  // TABLE 1: CLOSED JOs BY PROVINCE AND PACKAGE
  const table1Data = useMemo(() => {
    // Collect provinces present in the filtered rows in order: ALBAY, MASBATE, SORSOGON
    const allProvinces = ['ALBAY', 'MASBATE', 'SORSOGON'];
    const activeProvinces = allProvinces.filter((p) =>
      rows.some((r) => r.province === p)
    );

    // If filtered rows don't have standard provinces, take whatever provinces exist in rows
    const provincesToDisplay: string[] =
      activeProvinces.length > 0
        ? activeProvinces
        : Array.from(new Set<string>(rows.map((r) => r.province).filter(Boolean)));

    const packageOrder = ['FIBERX', 'SME', 'BIDA'];

    let grandTotal = 0;

    const provinceGroups = provincesToDisplay.map((province) => {
      const provRows = rows.filter((r) => r.province === province);
      let provTotal = 0;

      // Group by package
      const packageRows: Array<{ pkg: string; count: number }> = [];

      for (const pkg of packageOrder) {
        const count = provRows.filter((r) => r.package === pkg).length;
        if (count > 0) {
          packageRows.push({ pkg, count });
          provTotal += count;
        }
      }

      // Check any other package not in standard list
      const otherPackages: string[] = Array.from(
        new Set<string>(
          provRows
            .map((r) => r.package)
            .filter((p): p is string => Boolean(p) && !packageOrder.includes(p))
        )
      );
      for (const pkg of otherPackages) {
        const count = provRows.filter((r) => r.package === pkg).length;
        if (count > 0) {
          packageRows.push({ pkg, count });
          provTotal += count;
        }
      }

      grandTotal += provTotal;

      return {
        province,
        packages: packageRows,
        total: provTotal,
      };
    });

    return {
      provinceGroups,
      grandTotal,
    };
  }, [rows]);

  // TABLE 2: MRC BY PACKAGE (SUM OF MRC)
  // Rows: SME, FIBERX, BIDA, GRAND TOTAL
  const table2Data = useMemo(() => {
    const packages = ['SME', 'FIBERX', 'BIDA'];
    let grandTotal = 0;

    const items = packages.map((pkg) => {
      const sumMrc = rows
        .filter((r) => r.package === pkg)
        .reduce((sum, r) => sum + (r.mrc || 0), 0);
      grandTotal += sumMrc;
      return { pkg, mrc: sumMrc };
    });

    return {
      items,
      grandTotal,
    };
  }, [rows]);

  // TABLE 3: JO COUNT BY PACKAGE (COUNT OF ACTIVATED JOs)
  // Rows: FIBERX, SME, BIDA, GRAND TOTAL
  const table3Data = useMemo(() => {
    const packages = ['FIBERX', 'SME', 'BIDA'];
    let grandTotal = 0;

    const items = packages.map((pkg) => {
      const count = rows.filter((r) => r.package === pkg).length;
      grandTotal += count;
      return { pkg, count };
    });

    return {
      items,
      grandTotal,
    };
  }, [rows]);

  return (
    <section className="mb-8" id="total-closed-section">
      <div className="mb-4">
        <h2 className="text-xl font-bold uppercase tracking-tight text-[#123b31]">TOTAL CLOSED</h2>
        <p className="text-sm text-gray-500 mt-0.5 font-medium">
          Compact tables • Monthly closed JO details from the TOTAL CLOSED worksheet
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* TABLE 1: CLOSED JOs BY PROVINCE AND PACKAGE */}
        <div className="lg:col-span-1 bg-white border border-[#dcece6] rounded-2xl p-5 shadow-sm">
          <div className="pb-3 border-b border-[#edf3f0]">
            <h3 className="text-sm font-bold text-[#005e47] uppercase tracking-wide">
              Closed JOs by Province and Package
            </h3>
          </div>

          <div className="overflow-x-auto mt-3">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-[#f2f8f5] text-gray-700 font-semibold border-b border-[#dcece6]">
                  <th className="py-2.5 px-3">PROVINCE</th>
                  <th className="py-2.5 px-3">PACKAGE</th>
                  <th className="py-2.5 px-3">MONTH</th>
                  <th className="py-2.5 px-3 text-right">TOTAL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0f5f2]">
                {table1Data.provinceGroups.map((group) => (
                  <React.Fragment key={group.province}>
                    {group.packages.map((pkgRow, idx) => (
                      <tr key={pkgRow.pkg} className="hover:bg-[#fafcfb]">
                        <td className="py-2 px-3 font-semibold text-gray-800">
                          {idx === 0 ? group.province : ''}
                        </td>
                        <td className="py-2 px-3 text-gray-600 pl-4">{pkgRow.pkg}</td>
                        <td className="py-2 px-3 text-gray-500">{monthName}</td>
                        <td className="py-2 px-3 text-right font-medium text-gray-800">
                          {formatCount(pkgRow.count)}
                        </td>
                      </tr>
                    ))}
                    {/* Province Total Row */}
                    <tr className="bg-[#f7faf9] font-bold text-[#0a684d] border-t border-[#e2ece7]">
                      <td colSpan={3} className="py-2 px-3">
                        {group.province} TOTAL
                      </td>
                      <td className="py-2 px-3 text-right">
                        {formatCount(group.total)}
                      </td>
                    </tr>
                  </React.Fragment>
                ))}

                {/* GRAND TOTAL */}
                <tr className="bg-[#e8f8f0] font-extrabold text-[#005e47] border-t-2 border-[#b5e6d0]">
                  <td colSpan={3} className="py-2.5 px-3 uppercase">
                    GRAND TOTAL
                  </td>
                  <td className="py-2.5 px-3 text-right text-sm">
                    {formatCount(table1Data.grandTotal)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* TABLE 2: SUM OF MRC */}
        <div className="lg:col-span-1 bg-white border border-[#dcece6] rounded-2xl p-5 shadow-sm">
          <div className="pb-3 border-b border-[#edf3f0]">
            <h3 className="text-sm font-bold text-[#005e47] uppercase tracking-wide">
              SUM OF MRC
            </h3>
          </div>

          <div className="overflow-x-auto mt-3">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-[#f2f8f5] text-gray-700 font-semibold border-b border-[#dcece6]">
                  <th className="py-2.5 px-3">PACKAGE</th>
                  <th className="py-2.5 px-3">MONTH</th>
                  <th className="py-2.5 px-3 text-right">GRAND TOTAL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0f5f2]">
                {table2Data.items.map((item) => (
                  <tr key={item.pkg} className="hover:bg-[#fafcfb]">
                    <td className="py-2.5 px-3 font-semibold text-gray-700">
                      {item.pkg}
                    </td>
                    <td className="py-2.5 px-3 text-gray-500">{monthName}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-gray-800">
                      {formatPeso(item.mrc)}
                    </td>
                  </tr>
                ))}

                {/* GRAND TOTAL */}
                <tr className="bg-[#e8f8f0] font-extrabold text-[#005e47] border-t-2 border-[#b5e6d0]">
                  <td colSpan={2} className="py-2.5 px-3 uppercase">
                    GRAND TOTAL
                  </td>
                  <td className="py-2.5 px-3 text-right text-sm">
                    {formatPeso(table2Data.grandTotal)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* TABLE 3: COUNT OF ACTIVATED JOs */}
        <div className="lg:col-span-1 bg-white border border-[#dcece6] rounded-2xl p-5 shadow-sm">
          <div className="pb-3 border-b border-[#edf3f0]">
            <h3 className="text-sm font-bold text-[#005e47] uppercase tracking-wide">
              COUNT OF ACTIVATED JOs
            </h3>
          </div>

          <div className="overflow-x-auto mt-3">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-[#f2f8f5] text-gray-700 font-semibold border-b border-[#dcece6]">
                  <th className="py-2.5 px-3">PACKAGE</th>
                  <th className="py-2.5 px-3">MONTH</th>
                  <th className="py-2.5 px-3 text-right">GRAND TOTAL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0f5f2]">
                {table3Data.items.map((item) => (
                  <tr key={item.pkg} className="hover:bg-[#fafcfb]">
                    <td className="py-2.5 px-3 font-semibold text-gray-700">
                      {item.pkg}
                    </td>
                    <td className="py-2.5 px-3 text-gray-500">{monthName}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-gray-800">
                      {formatCount(item.count)}
                    </td>
                  </tr>
                ))}

                {/* GRAND TOTAL */}
                <tr className="bg-[#e8f8f0] font-extrabold text-[#005e47] border-t-2 border-[#b5e6d0]">
                  <td colSpan={2} className="py-2.5 px-3 uppercase">
                    GRAND TOTAL
                  </td>
                  <td className="py-2.5 px-3 text-right text-sm">
                    {formatCount(table3Data.grandTotal)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
};
