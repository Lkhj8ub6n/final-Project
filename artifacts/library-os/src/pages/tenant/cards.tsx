import React, { useState } from "react";
import { DashboardLayout } from "@/components/layouts";
import { useListCards, useListPlatforms } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Layers, Star } from "lucide-react";

export default function TenantCards() {
  const { data: cards, isLoading: cardsLoading } = useListCards();
  const { data: platforms, isLoading: platformsLoading } = useListPlatforms();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-display font-bold">بطاقات المنصات التعليمية</h2>
          <p className="text-muted-foreground mt-1">المنصات التعليمية وأسعار بطاقاتها</p>
        </div>

        {/* Platforms Grid */}
        <div>
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" />
            المنصات المتاحة
          </h3>
          {platformsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Array(3).fill(0).map((_, i) => <div key={i} className="h-48 bg-white rounded-2xl animate-pulse border border-border/50" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {platforms?.map((platform: any) => (
                <Card key={platform.id} className="border-0 shadow-sm rounded-2xl overflow-hidden group hover:shadow-lg transition-all">
                  <div className="h-2 bg-gradient-to-r from-primary to-primary/60" />
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-display font-bold text-xl text-foreground">{platform.name}</h3>
                        <p className="text-sm text-muted-foreground mt-0.5">{platform.description}</p>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <CreditCard className="w-5 h-5 text-primary" />
                      </div>
                    </div>

                    {platform.currentOffer && (
                      <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-xl p-3 mb-4">
                        <Star className="w-4 h-4 text-amber-500 shrink-0" />
                        <p className="text-xs font-bold text-amber-700">{platform.currentOffer}</p>
                      </div>
                    )}

                    <div className="space-y-2">
                      <p className="text-xs font-bold text-muted-foreground mb-2">أسعار البطاقات</p>
                      {platform.pricingTiers?.map((tier: any, i: number) => (
                        <div key={i} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg border border-border/40">
                          <span className="text-sm font-bold">بطاقة {tier.cardValue} د.أ</span>
                          <div className="text-left">
                            {tier.discountedPrice ? (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground line-through">{tier.price} د.أ</span>
                                <span className="font-bold text-green-600">{tier.discountedPrice} د.أ</span>
                              </div>
                            ) : (
                              <span className="font-bold text-primary">{tier.price} د.أ</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 pt-3 border-t border-border/40 flex flex-wrap gap-2">
                      {platform.grades?.slice(0, 3).map((g: string) => (
                        <Badge key={g} variant="secondary" className="text-xs rounded-lg">{g}</Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Cards inventory */}
        <div>
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary" />
            مخزون البطاقات
          </h3>
          {cardsLoading ? (
            <div className="h-32 bg-white rounded-2xl animate-pulse border border-border/50" />
          ) : !cards?.length ? (
            <div className="bg-white rounded-2xl border border-border/50 p-10 text-center text-muted-foreground">
              <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-bold">لا توجد بطاقات في المخزون</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-border/50 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-right">
                  <thead className="text-xs text-muted-foreground bg-gray-50/70 border-b border-border/50">
                    <tr>
                      <th className="px-6 py-4 font-bold">البطاقة</th>
                      <th className="px-6 py-4 font-bold">المنصة</th>
                      <th className="px-6 py-4 font-bold">القيمة</th>
                      <th className="px-6 py-4 font-bold">المخزون</th>
                      <th className="px-6 py-4 font-bold">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {cards.map((card: any) => (
                      <tr key={card.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4 font-bold">{card.name}</td>
                        <td className="px-6 py-4 text-muted-foreground">{card.platformName}</td>
                        <td className="px-6 py-4 font-bold text-primary">{parseFloat(card.value || 0).toFixed(3)} د.أ</td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-lg text-xs font-bold ${
                            card.stockQuantity <= 0 ? "bg-destructive/10 text-destructive" :
                            card.stockQuantity <= 5 ? "bg-amber-100 text-amber-700" :
                            "bg-green-100 text-green-700"
                          }`}>
                            {card.stockQuantity}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${card.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                            {card.isActive ? "نشط" : "غير نشط"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
